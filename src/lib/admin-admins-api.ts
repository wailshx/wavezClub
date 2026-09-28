// Owner-managed admin access + self-service admin profiles.
// Server-only (lives in src/lib, away from the **/server/** import-protection).
import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

// ─── Sections ────────────────────────────────────────────────────────────────

/** Sidebar sections an owner can grant/restrict per admin. */
export const ADMIN_SECTIONS = [
  "dashboard",
  "members",
  "events",
  "registrations",
  "team",
  "leaders",
] as const;
export type AdminSection = (typeof ADMIN_SECTIONS)[number];

const SECTION_LABELS: Record<AdminSection, string> = {
  dashboard: "Dashboard",
  members: "Members",
  events: "Submissions",
  registrations: "Registrations",
  team: "Team",
  leaders: "Leaders",
};
export const adminSectionLabel = (section: AdminSection) => SECTION_LABELS[section];

// ─── Loose wrappers (tables absent from generated types) ────────────────────

type MutateResult = { error: { message: string } | null };
type SelectResult<T> = { data: T[] | null; error: { message: string } | null };
type SelectChain<T> = {
  eq(column: string, value: unknown): SelectChain<T>;
} & PromiseLike<SelectResult<T>>;
type MutateEq = { eq(column: string, value: unknown): MutateEq } & Promise<MutateResult>;

type LooseTable = {
  select(columns: string): SelectChain<Record<string, unknown>>;
  insert(row: Record<string, unknown>): Promise<MutateResult>;
  update(patch: Record<string, unknown>): MutateEq;
  delete(): MutateEq;
};
type LooseDb = { from(table: string): LooseTable };
type AdminContext = {
  supabase: SupabaseClient<Database>;
  userId: string;
  claims?: { email?: string };
};

const userRolesTable = (supabase: SupabaseClient<Database> | unknown) =>
  (supabase as unknown as LooseDb).from("user_roles");
const permissionsTable = (supabase: SupabaseClient<Database> | unknown) =>
  (supabase as unknown as LooseDb).from("admin_permissions");

// ─── Owner / session helpers ─────────────────────────────────────────────────

function getOwnerEmail(): string {
  return (process.env["OWNER_EMAIL"] ?? process.env["VITE_OWNER_EMAIL"] ?? "").toLowerCase();
}

async function getSupabaseAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type UserRoleRow = {
  user_id: string;
  role: string;
  admin_role: string | null;
  display_name: string | null;
  avatar_url: string | null;
  disabled_at: string | null;
  created_at: string | null;
};

type MemberInfoRow = { email: string; department: string | null; level: string | null };

/** Load the signed-in admin's identity, role and effective section access. */
async function loadSessionAccess(context: AdminContext) {
  const { supabase } = context;
  let email = (context.claims?.email ?? "").toLowerCase();
  if (!email) {
    const { data: userData } = await supabase.auth.getUser();
    email = (userData?.user?.email ?? "").toLowerCase();
  }
  const isOwner = Boolean(email) && email === getOwnerEmail();

  const { data: roleRows } = await userRolesTable(supabase)
    .select("user_id, role, admin_role, display_name, avatar_url, disabled_at")
    .eq("user_id", context.userId)
    .eq("role", "admin");
  const role = (roleRows ?? [])[0] as UserRoleRow | undefined;

  const { data: permRows } = await permissionsTable(supabase)
    .select("section, granted")
    .eq("user_id", context.userId);
  const restricted = new Set(
    ((permRows ?? []) as Record<string, unknown>[])
      .filter((row) => row["granted"] === false)
      .map((row) => String(row["section"])) as AdminSection[],
  );

  const disabled = Boolean(role?.disabled_at) && !isOwner;
  const sections = isOwner
    ? ADMIN_SECTIONS
    : ADMIN_SECTIONS.filter((section) => !restricted.has(section));

  return {
    isAdmin: Boolean(role),
    isOwner,
    disabled,
    role: role?.admin_role ?? null,
    displayName: role?.display_name ?? null,
    avatarUrl: role?.avatar_url ?? null,
    email,
    sections,
  };
}

export type AdminSession = Awaited<ReturnType<typeof loadSessionAccess>>;

/**
 * Enforce section access inside server functions. The owner is always exempt.
 * The "dashboard" landing is allowed for every admin.
 * Returns the access info plus the caller's supabase client.
 */
export async function requireSection(context: AdminContext, section: AdminSection) {
  const access = await loadSessionAccess(context);
  if (!access.isAdmin) throw new Error("Not authorized");
  if (access.disabled) throw new Error("Your admin access has been revoked by the owner.");
  if (access.isOwner) return { ...access, supabase: context.supabase };
  if (section === "dashboard" || access.sections.includes(section)) {
    return { ...access, supabase: context.supabase };
  }
  throw new Error("You don't have permission to access this section.");
}
/**
 * Sections that all live in the Submissions workspace.
 *
 * Submissions absorbed the old standalone Registrations tab, so the two stored
 * permission keys are equivalent. `registrations` is kept in ADMIN_SECTIONS so
 * grants made before the merge keep working instead of silently locking anyone
 * out of their own submissions.
 */
export const SUBMISSION_SECTIONS = ["events", "registrations"] as const;

/** `requireSection`, but satisfied by any one of the given sections. */
export async function requireAnySection(context: AdminContext, ...sections: AdminSection[]) {
  const access = await loadSessionAccess(context);
  if (!access.isAdmin) throw new Error("Not authorized");
  if (access.disabled) throw new Error("Your admin access has been revoked by the owner.");
  if (access.isOwner || sections.some((section) => access.sections.includes(section))) {
    return { ...access, supabase: context.supabase };
  }
  throw new Error("You don't have permission to access this section.");
}

export type SectionRequest = AdminSession & { supabase: SupabaseClient<Database> };

// ─── Admin role requests (owner-managed) ─────────────────────────────────────

/**
 * Pending applications to join the club's officers.
 *
 * The emailed accept/cancel link is the primary path, but it is only useful
 * while the owner still has the email. These are the in-console equivalents so
 * a request can also be approved, rejected or dropped from the Admins tab.
 */
const adminRequestsAdmin = (supabase: SupabaseClient<Database> | unknown) =>
  supabase as unknown as LooseDb;

const adminRequestsTable = (supabase: SupabaseClient<Database> | unknown) =>
  adminRequestsAdmin(supabase).from("admin_requests");

export const listAdminRequests = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = adminRequestsTable(supabaseAdmin);

    const { data, error } = await table.select(
      "id, first_name, last_name, email, phone, department, status, created_at, decided_at",
    );
    if (error) throw new Error(error.message);

    return ((data ?? []) as Record<string, unknown>[])
      .map((row) => ({
        id: String(row["id"]),
        name:
          `${String(row["first_name"] ?? "")} ${String(row["last_name"] ?? "")}`.trim() ||
          "Anonymous",
        email: String(row["email"] ?? ""),
        phone: String(row["phone"] ?? ""),
        role: String(row["department"] ?? ""),
        status: String(row["status"] ?? "pending"),
        created_at: String(row["created_at"] ?? ""),
        decided_at: row["decided_at"] ? String(row["decided_at"]) : null,
      }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  });

/**
 * Approve or reject a request from the console.
 *
 * Approval is the same work the emailed link does: find (or invite) the auth
 * user, then grant the role. Refuses anything not `pending` so a request can
 * never be decided twice from two different entry points.
 */
export const decideAdminRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { requestId: string; action: "approve" | "reject" }) => ({
    requestId: input.requestId,
    action: input.action,
  }))
  .handler(async ({ context, data: { requestId, action } }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = adminRequestsTable(supabaseAdmin);

    const { data, error } = await table.select("*").eq("id", requestId);
    if (error) throw new Error(error.message);
    const request = (data ?? [])[0];
    if (!request) throw new Error("Request not found.");
    if (request["status"] !== "pending") {
      throw new Error("This request has already been processed.");
    }
    const email = String(request["email"] ?? "");
    if (!email) throw new Error("This request has no email address.");

    if (action === "reject") {
      const { error: rejectError } = await table
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("id", requestId);
      if (rejectError) throw new Error(rejectError.message);
      return true;
    }

    const admin = supabaseAdmin.auth.admin;
    const { data: listed } = await admin.listUsers({ perPage: 1000 });
    let userId = listed?.users.find(
      (user: { email?: string }) => user.email?.toLowerCase() === email.toLowerCase(),
    )?.id;

    if (!userId) {
      const request2 = await import("@tanstack/react-start/server");
      const req = request2.getRequest();
      const proto = req?.headers.get("x-forwarded-proto") ?? "https";
      const host = req?.headers.get("x-forwarded-host") ?? req?.headers.get("host");
      const redirectTo = host ? `${proto}://${host}/gestion` : undefined;

      const invited = await admin.inviteUserByEmail(email, redirectTo ? { redirectTo } : {});
      if (invited.error) throw new Error(invited.error.message);

      const { data: afterInvite } = await admin.listUsers({ perPage: 1000 });
      userId = afterInvite?.users.find(
        (user: { email?: string }) => user.email?.toLowerCase() === email.toLowerCase(),
      )?.id;
    }
    if (!userId) throw new Error("Could not resolve the user account.");

    // (user_id, role) is unique, so an existing grant is a no-op rather than an
    // error — check before inserting, because the loose wrapper cannot filter.
    const roles = adminRequestsAdmin(supabaseAdmin).from("user_roles");
    const { data: existingRole } = await roles.select("id").eq("user_id", userId);
    if ((existingRole ?? []).length === 0) {
      const { error: roleError } = await roles.insert({
        user_id: userId,
        role: "admin",
        admin_role: request["department"],
      });
      if (roleError) throw new Error(roleError.message);
    }

    const { error: approveError } = await table
      .update({ status: "approved", decided_at: new Date().toISOString() })
      .eq("id", requestId);
    if (approveError) throw new Error(approveError.message);
    return true;
  });

/**
 * Delete a request outright, whatever its status.
 *
 * `decideAdminRequest` leaves an audit trail; this is for the cases that is the
 * wrong shape — a spam flood from one address, or a request for a role that no
 * longer exists. Owner-only, and deliberately not a bulk operation: deleting an
 * application is not reversible, so it is one deliberate click at a time.
 */
export const deleteAdminRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((requestId: string) => requestId)
  .handler(async ({ context, data: requestId }) => {
    await requireOwner(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const table = adminRequestsTable(supabaseAdmin);

    const { error } = await table.delete().eq("id", requestId);
    if (error) throw new Error(error.message);
    return true;
  });

/** Owner-only gate — used by the Admins page data functions. */
export async function requireOwner(context: AdminContext) {
  const access = await loadSessionAccess(context);
  if (!access.isAdmin) throw new Error("Not authorized");
  if (!access.isOwner) throw new Error("Only the club owner can manage admins.");
  return access;
}

// ─── Server functions ────────────────────────────────────────────────────────

/** Current admin's session: identity + role + effective section permissions. */
export const getAdminSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadSessionAccess(context));

/** Update the signed-in admin's own display name + avatar URL. */
export const updateAdminProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { displayName: string; avatarUrl: string | null }) => ({
    displayName: input.displayName.trim().slice(0, 60),
    avatarUrl: input.avatarUrl?.trim() || null,
  }))
  .handler(async ({ context, data: { displayName, avatarUrl } }) => {
    await loadSessionAccess(context); // must be an admin for their row to update
    const { error } = await (
      context.supabase as unknown as {
        rpc: (
          name: string,
          params: Record<string, string | null>,
        ) => Promise<{ error: { message: string } | null }>;
      }
    ).rpc("update_own_profile", {
      p_display_name: displayName,
      p_avatar_url: avatarUrl,
    });
    if (error) throw new Error(error.message);
    return true;
  });

export type AdminRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  avatar_url: string | null;
  admin_role: string | null;
  disabled_at: string | null;
  department: string | null;
  level: string | null;
  /** When the admin was approved (user_roles.created_at). */
  created_at: string | null;
  /** Sections the owner has explicitly restricted (granted=false rows). */
  restricted: AdminSection[];
};

/** Owner-only: all approved admins with their profile + current restrictions. */
export const listAdmins = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireOwner(context);
    const supabaseAdmin = await getSupabaseAdmin();

    const { data: roleRows } = await userRolesTable(supabaseAdmin)
      .select("user_id, admin_role, display_name, avatar_url, disabled_at, created_at")
      .eq("role", "admin");
    const { data: permRows } = await permissionsTable(supabaseAdmin).select(
      "user_id, section, granted",
    );

    const { data: userList, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
    if (usersError) throw new Error(usersError.message);

    const emailById = new Map<string, string>(
      (userList?.users ?? []).map((u) => [u.id, u.email ?? ""]),
    );

    const restrictedByUser = new Map<string, AdminSection[]>();
    for (const row of (permRows ?? []) as Record<string, unknown>[]) {
      if (row["granted"] !== false) continue;
      const uid = String(row["user_id"]);
      const list = restrictedByUser.get(uid) ?? [];
      list.push(String(row["section"]) as AdminSection);
      restrictedByUser.set(uid, list);
    }

    const { data: memberRows } = await (
      supabaseAdmin.from("members") as unknown as LooseTable
    ).select("email, department, level");
    const memberByEmail = new Map<string, MemberInfoRow>();
    for (const row of (memberRows ?? []) as Record<string, unknown>[]) {
      const email = String(row["email"] ?? "").toLowerCase();
      if (email) {
        memberByEmail.set(email, {
          email,
          department: (row["department"] as string | null) ?? null,
          level: (row["level"] as string | null) ?? null,
        });
      }
    }

    const admins: AdminRow[] = ((roleRows ?? []) as unknown as UserRoleRow[]).map((row) => {
      const userId = row.user_id;
      const email = (emailById.get(userId) ?? "").toLowerCase();
      const member = email ? memberByEmail.get(email) : undefined;
      return {
        user_id: userId,
        email: email || null,
        display_name: row.display_name,
        avatar_url: row.avatar_url ?? null,
        admin_role: row.admin_role,
        disabled_at: row.disabled_at,
        department: member?.department ?? null,
        level: member?.level ?? null,
        created_at: row.created_at ?? null,
        restricted: restrictedByUser.get(userId) ?? [],
      };
    });

    admins.sort(
      (a, b) =>
        (b.disabled_at ? 1 : 0) - (a.disabled_at ? 1 : 0) ||
        (a.display_name ?? a.email ?? "").localeCompare(b.display_name ?? b.email ?? ""),
    );
    return admins;
  });

/** Owner-only: grant/restrict one section for one admin. Absent row = full access. */
export const setAdminSectionAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { adminId: string; section: AdminSection; allowed: boolean }) => ({
    adminId: input.adminId,
    section: input.section,
    allowed: input.allowed,
  }))
  .handler(async ({ context, data: { adminId, section, allowed } }) => {
    await requireOwner(context);
    const supabaseAdmin = await getSupabaseAdmin();
    const table = permissionsTable(supabaseAdmin);

    // Submissions has two stored keys with identical meaning. Write both so a
    // grant can never be left half-revoked by a toggle.
    const sections = SUBMISSION_SECTIONS.includes(section as (typeof SUBMISSION_SECTIONS)[number])
      ? [...SUBMISSION_SECTIONS]
      : [section];

    for (const key of sections) {
      const { error: clearError } = await table.delete().eq("user_id", adminId).eq("section", key);
      if (clearError) throw new Error(clearError.message);
      if (!allowed) {
        const { error } = await table.insert({ user_id: adminId, section: key, granted: false });
        if (error) throw new Error(error.message);
      }
    }
    return true;
  });

/** Owner-only: soft-disable (or re-enable) an admin's access entirely. */
export const setAdminDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { adminId: string; disabled: boolean }) => ({
    adminId: input.adminId,
    disabled: input.disabled,
  }))
  .handler(async ({ context, data: { adminId, disabled } }) => {
    const access = await requireOwner(context);
    if (disabled && context.userId === adminId) {
      throw new Error("You can't disable your own owner account.");
    }
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await userRolesTable(supabaseAdmin)
      .update({ disabled_at: disabled ? new Date().toISOString() : null })
      .eq("user_id", adminId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return true;
  });
