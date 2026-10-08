// Owner-managed admin access + self-service admin profiles.
// Server-only (lives in src/lib, away from the **/server/** import-protection).
import { createServerFn } from "@tanstack/react-start";
import { ensureAdminRoleGrant } from "@/lib/admin-role-grant";
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
  return (process.env["OWNER_EMAIL"] ?? import.meta.env["VITE_OWNER_EMAIL"] ?? "").toLowerCase();
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
  const isPresident = role?.admin_role === "president";
  const sections = isOwner
    ? ADMIN_SECTIONS
    : ADMIN_SECTIONS.filter((section) => !restricted.has(section));

  return {
    isAdmin: Boolean(role),
    isOwner,
    isPresident,
    // Mirrors `requireAdminManager` so the UI never offers an action the
    // server would reject. The owner is never `disabled` by definition.
    canManageAdmins: Boolean(role) && !disabled && (isOwner || isPresident),
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
      const { getSiteUrl } = await import("@/lib/site-url.server");
      const redirectTo = `${await getSiteUrl()}/gestion/set-password`;

      const invited = await admin.generateLink({
        type: "invite",
        email,
        options: { redirectTo },
      });
      console.error(
        `[admin-request] generateLink(type=invite, console) called for email=${email} ` +
          `ok=${invited.error ? "false" : "true"} ` +
          `error=${invited.error ? invited.error.message : "none"} ` +
          `status=${invited.error ? invited.error.status : "ok"}`,
      );
      if (invited.error) throw new Error(`Invite failed: ${invited.error.message}`);

      const { data: afterInvite } = await admin.listUsers({ perPage: 1000 });
      userId = afterInvite?.users.find(
        (user: { email?: string }) => user.email?.toLowerCase() === email.toLowerCase(),
      )?.id;
    }
    if (!userId) throw new Error("Could not resolve the user account.");

    // Same helper as the emailed-review-link path in admin-gestion-api.ts.
    // Filtering on `role = 'admin'` (not just user_id) matters: a member can
    // hold a non-admin user_roles row, and matching on user_id alone would skip
    // the grant for someone who is also a member.
    const grant = await ensureAdminRoleGrant(supabaseAdmin, {
      userId,
      adminRole: String(request["department"]),
    });
    if (!grant.ok) throw new Error(grant.error);

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

/**
 * Gate for acting on other admins: the owner and the president are peers.
 *
 * The owner is the club's `president` in every respect here, so anyone holding
 * that role manages admins exactly as the owner does. `isOwner` is still kept
 * as its own condition because the owner stays exempt from revocation and from
 * section restrictions — a president is an ordinary row that can be demoted.
 */
export async function requireAdminManager(context: AdminContext) {
  const access = await loadSessionAccess(context);
  if (!access.isAdmin) throw new Error("Not authorized");
  if (access.disabled) throw new Error("Your admin access has been revoked by the owner.");
  if (!access.isOwner && access.role !== "president") {
    throw new Error("Only the club owner or the president can manage admins.");
  }
  return access;
}

/**
 * Refuse any mutating action whose *target* is the owner account.
 *
 * The owner is the root of the permission tree: `isOwner` bypasses section
 * restrictions and can never be revoked, so restricting that row would be
 * silently ignored while deleting it would lock the club out of its own
 * console. Checking it here — rather than trusting the caller to filter the
 * list — keeps it unreachable no matter which button was pressed.
 */
async function assertNotOwnerRow(adminId: string) {
  const supabaseAdmin = await getSupabaseAdmin();
  const { data, error } = await supabaseAdmin.auth.admin.getUserById(adminId);
  if (error) throw new Error(error.message);
  const email = (data?.user?.email ?? "").toLowerCase();
  if (email && email === getOwnerEmail()) {
    throw new Error("The club owner's account can't be modified or removed.");
  }
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

/** Owner/president: grant/restrict one section for one admin. Absent row = full access. */
export const setAdminSectionAllowed = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { adminId: string; section: AdminSection; allowed: boolean }) => ({
    adminId: input.adminId,
    section: input.section,
    allowed: input.allowed,
  }))
  .handler(async ({ context, data: { adminId, section, allowed } }) => {
    await requireAdminManager(context);
    await assertNotOwnerRow(adminId);
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

/** Owner/president: soft-disable (or re-enable) an admin's access entirely. */
export const setAdminDisabled = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { adminId: string; disabled: boolean }) => ({
    adminId: input.adminId,
    disabled: input.disabled,
  }))
  .handler(async ({ context, data: { adminId, disabled } }) => {
    await requireAdminManager(context);
    // Only the caller's own account is off-limits here; the owner row is
    // handled by `assertNotOwnerRow` below, which is about the *target*.
    if (context.userId === adminId) {
      throw new Error("You can't revoke your own admin account.");
    }
    await assertNotOwnerRow(adminId);
    const supabaseAdmin = await getSupabaseAdmin();
    const { error } = await userRolesTable(supabaseAdmin)
      .update({ disabled_at: disabled ? new Date().toISOString() : null })
      .eq("user_id", adminId)
      .eq("role", "admin");
    if (error) throw new Error(error.message);
    return true;
  });

/**
 * Owner/president: permanently strip an admin's officer access.
 *
 * Distinct from `setAdminDisabled`, which is reversible and keeps the row.
 * This removes the `user_roles` grant outright, so `has_role` stops returning
 * true and nothing can re-derive the access from what is left behind.
 *
 * Two things are deliberately left alone. The Supabase auth account and the
 * `members` row are untouched — being removed as an officer is not the same as
 * deleting a person, and destroying someone's login from an admin panel is not
 * a decision this button should be able to make. The request history is kept
 * as the audit trail.
 *
 * The approved request, though, is withdrawn, and that part is load-bearing
 * rather than housekeeping: `ensureApprovedRequestRole` re-grants an officer
 * role to anyone whose session email still has an approved request, so
 * deleting only the role row would resurrect the admin on their next sign-in.
 *
 * Ordering is chosen so that any failure leaves a safe state — the approval is
 * withdrawn first, so a later error can never leave a removed admin eligible
 * for self-healing.
 */
export const deleteAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { adminId: string }) => ({ adminId: input.adminId }))
  .handler(async ({ context, data: { adminId } }) => {
    await requireAdminManager(context);
    if (context.userId === adminId) {
      throw new Error("You can't remove your own admin account.");
    }
    await assertNotOwnerRow(adminId);

    const supabaseAdmin = await getSupabaseAdmin();
    const { data: target, error: targetError } =
      await supabaseAdmin.auth.admin.getUserById(adminId);
    if (targetError) throw new Error(targetError.message);
    const email = (target?.user?.email ?? "").toLowerCase();

    // Only ever remove a row that is really an admin, so a mistyped id
    // removes nothing rather than something unrelated.
    const { data: roleRows, error: roleError } = await userRolesTable(supabaseAdmin)
      .select("user_id")
      .eq("user_id", adminId)
      .eq("role", "admin");
    if (roleError) throw new Error(roleError.message);
    if (!roleRows || roleRows.length === 0) throw new Error("That account isn't an admin.");

    // 1. Withdraw the approval that authorises the grant. First, so that no
    //    later failure can leave a self-heal-eligible admin behind.
    if (email) {
      const { error: approvalError } = await adminRequestsTable(supabaseAdmin)
        .update({ status: "rejected", decided_at: new Date().toISOString() })
        .eq("email", email)
        .eq("status", "approved");
      if (approvalError) throw new Error(approvalError.message);
    }

    // 2. Section permissions mean nothing once the role is gone.
    const { error: permError } = await permissionsTable(supabaseAdmin)
      .delete()
      .eq("user_id", adminId);
    if (permError) throw new Error(permError.message);

    // 3. Drop the officer role itself.
    const { error: roleDeleteError } = await userRolesTable(supabaseAdmin)
      .delete()
      .eq("user_id", adminId)
      .eq("role", "admin");
    if (roleDeleteError) throw new Error(roleDeleteError.message);

    return true;
  });

/**
 * Owner/president: (re)send the set-password link to an already-approved officer.
 *
 * Not a convenience. The original link is single-use, so the first misdelivery
 * or stray click spends it, and the officer is left with an account and no way
 * in — with no approval left to replay. This is the only way to hand them a new
 * one, and it reports whether the mail actually went out rather than assuming.
 */
export const resendAdminInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { adminId: string }) => ({ adminId: input.adminId }))
  .handler(async ({ context, data: { adminId } }) => {
    await requireAdminManager(context);
    await assertNotOwnerRow(adminId);

    const supabaseAdmin = await getSupabaseAdmin();
    const { data: roleRows, error: roleError } = await userRolesTable(supabaseAdmin)
      .select("user_id, display_name")
      .eq("user_id", adminId)
      .eq("role", "admin");
    if (roleError) throw new Error(roleError.message);
    const role = (roleRows ?? [])[0] as Pick<UserRoleRow, "display_name"> | undefined;
    if (!role) throw new Error("That account isn't an admin.");

    const { data: target, error: targetError } =
      await supabaseAdmin.auth.admin.getUserById(adminId);
    if (targetError) throw new Error(targetError.message);
    const email = (target?.user?.email ?? "").toLowerCase();
    if (!email) throw new Error("That account has no email address.");

    const [{ buildSetPasswordLink, sendSetPasswordInvite }, { getSiteUrl }] = await Promise.all([
      import("@/lib/admin-invite-link.server"),
      import("@/lib/site-url.server"),
    ]);

    const built = await buildSetPasswordLink(
      supabaseAdmin.auth.admin,
      email,
      `${await getSiteUrl()}/gestion/set-password`,
    );
    if ("error" in built) throw new Error(`Could not create the link: ${built.error}`);

    const sent = await sendSetPasswordInvite({
      to: email,
      name: role.display_name,
      link: built.link,
    });

    return {
      ok: true as const,
      email,
      emailSent: sent.ok,
      emailError: sent.ok ? undefined : sent.error,
      // Handed back so the owner can copy it when mail is undeliverable.
      setPasswordLink: built.link,
    };
  });
