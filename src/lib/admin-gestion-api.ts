import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { GoTrueAdminApi as AuthAdminApi } from "@supabase/auth-js";

// ─── Constants ───────────────────────────────────────────────────────────────

export const ADMIN_ROLES = [
  "president",
  "vice_president",
  "media_leader",
  "vice_media_leader",
  "hr_leader",
  "vice_hr_leader",
] as const;

export type AdminRole = (typeof ADMIN_ROLES)[number];

/** Roles available on the public request form — the club's two departments
 * (Media and HR) only, per the current club structure. President is owner-only. */
export const SUBMITTABLE_ADMIN_ROLES = ["media_leader", "hr_leader"] as const;

export type SubmittableAdminRole = (typeof SUBMITTABLE_ADMIN_ROLES)[number];

export const DEPARTMENT_LABELS: Record<SubmittableAdminRole, string> = {
  media_leader: "Media",
  hr_leader: "HR",
};

// ─── Zod schema ──────────────────────────────────────────────────────────────

export const adminRequestSchema = z.object({
  firstName: z.string().trim().min(2, "Enter your first name").max(80),
  lastName: z.string().trim().min(2, "Enter your last name").max(80),
  department: z.enum(SUBMITTABLE_ADMIN_ROLES, { message: "Select a department" }),
  email: z.string().trim().email("Enter a valid email").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(30),
});

export type AdminRequestInput = z.infer<typeof adminRequestSchema>;

type AdminRequestStatus = "pending" | "approved" | "rejected";

type AdminRequestRow = {
  id: string;
  first_name: string;
  last_name: string;
  department: SubmittableAdminRole;
  email: string;
  phone: string;
  status: AdminRequestStatus;
  created_at: string;
  decided_at: string | null;
};

// ─── Typed Supabase wrapper for tables absent from generated types ──────────

type DbResult<T> = {
  data: T | null;
  error: { message: string } | null;
};

type RequestResult = DbResult<AdminRequestRow>;
type MutateResult = { error: { message: string } | null };

type AdminRequestsQuery = {
  select(...cols: string[]): AdminRequestsSelectChain;
  insert(row: {
    first_name: string;
    last_name: string;
    department: AdminRequestRow["department"];
    email: string;
    phone: string;
  }): Promise<MutateResult>;
  update(patch: { status: AdminRequestStatus; decided_at: string }): {
    eq(column: string, value: string): Promise<MutateResult>;
  };
  upsert(
    row: { user_id: string; role: "admin"; admin_role: AdminRole },
    opts: { onConflict: string },
  ): Promise<MutateResult>;
};

type AdminRequestsSelectChain = {
  eq(column: string, value: string): AdminRequestsWhereChain;
  order(column: string, opts: { ascending: boolean }): AdminRequestsWhereChain;
};

type AdminRequestsWhereChain = {
  single(): Promise<RequestResult>;
  limit(count: number): { single(): Promise<RequestResult> };
  order(column: string, opts: { ascending: boolean }): AdminRequestsWhereChain;
};

type RequestsDb = {
  from(table: "admin_requests"): AdminRequestsQuery;
};

type TypedAdmin = RequestsDb;

// ─── Token signing / verification (HMAC-SHA256) ─────────────────────────────

const enc = new TextEncoder();

function base64UrlEncode(bytes: Uint8Array<ArrayBuffer>): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(str: string): Uint8Array<ArrayBuffer> {
  const pad = str.length % 4 === 0 ? "" : "=".repeat(4 - (str.length % 4));
  const bin = atob(str.replace(/-/g, "+").replace(/_/g, "/") + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0)) as Uint8Array<ArrayBuffer>;
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signReviewToken(secret: string, requestId: string): Promise<string> {
  const expiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000; // 7 days
  const payload = `${requestId}:${expiresAt}`;
  const sig = await crypto.subtle.sign("HMAC", await hmacKey(secret), enc.encode(payload));
  return `${payload}.${base64UrlEncode(new Uint8Array(sig) as Uint8Array<ArrayBuffer>)}`;
}

export type DecodedReviewToken = { requestId: string; expiresAt: number } | null;

export async function verifyReviewToken(
  secret: string,
  token: string,
): Promise<DecodedReviewToken> {
  const lastDot = token.lastIndexOf(".");
  if (lastDot < 1) return null;

  const payload = token.slice(0, lastDot);
  const providedSig = token.slice(lastDot + 1);
  const parts = payload.split(":");
  if (parts.length !== 2) return null;

  const [requestId, expiresAtStr] = parts;
  if (!requestId || !expiresAtStr) return null;

  let valid: boolean;
  try {
    valid = await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret),
      base64UrlDecode(providedSig) as BufferSource,
      enc.encode(payload),
    );
  } catch {
    return null;
  }
  if (!valid) return null;

  const expiresAt = Number(expiresAtStr);
  if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) return null;

  return { requestId, expiresAt };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  const request = getRequest();
  if (!request) return "http://localhost:8081";
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  return host ? `${proto}://${host}` : "http://localhost:8081";
}

async function authAdmin(supabaseAdmin: SupabaseClient): Promise<AuthAdminApi> {
  return supabaseAdmin.auth.admin;
}

/** Public: submit an admin request (INSERT via RLS). */
export const submitAdminRequestAction = createServerFn({ method: "POST" })
  .validator(adminRequestSchema)
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const URL = process.env["SUPABASE_URL"];
    const KEY = process.env["SUPABASE_PUBLISHABLE_KEY"];
    if (!URL || !KEY) {
      return { ok: false as const, message: "Server configuration error." };
    }

    const supabase = createClient(URL, KEY, { auth: { persistSession: false } });
    const { error } = await supabase.from("admin_requests").insert({
      first_name: data.firstName,
      last_name: data.lastName,
      department: data.department,
      email: data.email.toLowerCase(),
      phone: data.phone,
    });

    if (error) {
      if (error.message.includes("already submitted a request")) {
        return {
          ok: false as const,
          message:
            "You already submitted a request recently — check your inbox or try again in a minute.",
        };
      }
      return { ok: false as const, message: "Something went wrong. Please try again." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { getOwnerEmail, getSigningSecret } = await import("@/lib/admin-gestion-config.server");
    const db = supabaseAdmin as unknown as TypedAdmin;
    const origin = getBaseUrl();

    const { data: newRow } = await db
      .from("admin_requests")
      .select("id")
      .eq("email", data.email.toLowerCase())
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    // No new row means we cannot build a review link; the request is still
    // inserted, so the owner must be told to look it up by hand.
    if (!newRow) {
      console.error(
        `[admin-request] inserted request for ${data.email} but could not read it back — ` +
          `no review link was emailed. Find it in admin_requests and review manually.`,
      );
      return { ok: true as const, requestId: null, ownerNotified: false };
    }

    const reviewUrl = `${origin}/gestion/review/${await signReviewToken(getSigningSecret(), newRow.id)}`;
    // The insert must not fail because mail did, but the request is STRANDED if
    // this owner alert is lost: /gestion/review/$token is the only approval path,
    // so nothing can be approved until the owner has that link. Surface the
    // failure loudly and hand the applicant a reference they can quote.
    const { sendResendEmail } = await import("@/lib/resend.server");
    const alert = await sendResendEmail({
      to: getOwnerEmail(),
      subject: "New admin request — Wavez Club",
      text: `There's a new admin request from ${data.firstName} ${data.lastName} — click to review: ${reviewUrl}`,
    });
    if (!alert.ok) {
      console.error(
        `[admin-request] OWNER ALERT FAILED for requestId=${newRow.id} email=${data.email} ` +
          `error=${alert.error}. This request is stuck in "pending" until you open it ` +
          `manually: ${reviewUrl}`,
      );
    }

    return { ok: true as const, requestId: newRow.id, ownerNotified: alert.ok };
  });

/** Owner-only: ensure the signed-in owner has the president admin role. */
export const ensureOwnerAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getOwnerEmail } = await import("@/lib/admin-gestion-config.server");
    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData?.user?.email?.toLowerCase();
    if (!email || email !== getOwnerEmail()) return false;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing } = (await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle()) as unknown as { data: { id: string } | null };

    if (existing) return true;

    const roleInsert = (
      supabaseAdmin.from("user_roles") as unknown as {
        insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      }
    ).insert;
    const { error } = await roleInsert({
      user_id: context.userId,
      role: "admin",
      admin_role: "president",
    });

    if (error) {
      console.error("[ensureOwnerAdmin] insert failed:", error.message);
      return false;
    }
    return true;
  });

/** Fetch request data by verified review token (for the review page). */
export const getReviewRequest = createServerFn({ method: "GET" })
  .validator((input: { token: string }) => ({ token: input.token }))
  .handler(async ({ data: { token } }) => {
    const { getSigningSecret } = await import("@/lib/admin-gestion-config.server");
    const decoded = await verifyReviewToken(getSigningSecret(), token);
    if (!decoded) {
      return { ok: false as const, message: "This link is invalid or has expired." };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as TypedAdmin;

    const { data: request, error: fetchError } = await db
      .from("admin_requests")
      .select("*")
      .eq("id", decoded.requestId)
      .single();

    if (fetchError || !request) {
      return { ok: false as const, message: "Request not found." };
    }

    return { ok: true as const, request } as const;
  });

/** Accept or cancel an admin request (owner action from review page). */
export const decideAdminRequestAction = createServerFn({ method: "POST" })
  .validator((input: { token: string; action: "accept" | "cancel" }) => ({
    token: input.token,
    action: input.action,
  }))
  .handler(async ({ data: { token, action } }) => {
    const { getSigningSecret } = await import("@/lib/admin-gestion-config.server");
    const decoded = await verifyReviewToken(getSigningSecret(), token);
    if (!decoded) throw new Error("This link is invalid or has expired.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as unknown as TypedAdmin;

    const { data: request, error: fetchError } = await db
      .from("admin_requests")
      .select("*")
      .eq("id", decoded.requestId)
      .single();

    if (fetchError || !request) throw new Error("Request not found.");
    if (request.status !== "pending") {
      throw new Error("This request has already been processed.");
    }

    if (action === "accept") {
      let userId: string | undefined;

      const admin = await authAdmin(supabaseAdmin);
      const { data: listResult } = await admin.listUsers({ perPage: 1000 });
      const existing = listResult?.users.find(
        (u) => u.email?.toLowerCase() === request.email.toLowerCase(),
      );
      if (existing?.id) {
        userId = existing.id;
      } else {
        const inviteResult = await admin.inviteUserByEmail(request.email, {
          redirectTo: `${getBaseUrl()}/gestion`,
        });
        if (inviteResult.error) throw new Error(inviteResult.error.message);

        const { data: afterInvite } = await admin.listUsers({ perPage: 1000 });
        const invited = afterInvite?.users.find(
          (u) => u.email?.toLowerCase() === request.email.toLowerCase(),
        );
        userId = invited?.id;
      }

      if (!userId) throw new Error("Could not resolve the user account.");

      await db
        .from("admin_requests")
        .upsert(
          { user_id: userId, role: "admin", admin_role: request.department },
          { onConflict: "user_id,role" },
        );

      await db
        .from("admin_requests")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", decoded.requestId);

      return { ok: true as const, action: "accept" as const, email: request.email };
    }

    // Cancel
    await db
      .from("admin_requests")
      .update({ status: "rejected", decided_at: new Date().toISOString() })
      .eq("id", decoded.requestId);

    // Sending failure must not undo the decision, but the applicant now believes
    // they were told — surface it so the owner can follow up by hand.
    const { sendClubEmail } = await import("@/lib/resend.server");
    const notice = await sendClubEmail({
      to: request.email,
      subject: "Wavez Club — admin request update",
      text: [
        `Hi ${request.first_name},`,
        "",
        "Thank you for your interest in joining the Wavez Club officer team.",
        "Unfortunately we are not able to approve your request at this time.",
        "",
        "You are welcome to submit a new request in the future.",
        "",
        "— Wavez Club",
      ].join("\n"),
    });
    if (!notice.ok) {
      console.error(
        `[admin-request] REJECTION EMAIL FAILED for requestId=${decoded.requestId} ` +
          `email=${request.email} error=${notice.error}`,
      );
    }

    return {
      ok: true as const,
      action: "cancel" as const,
      email: request.email,
      emailSent: notice.ok,
      emailError: notice.ok ? undefined : notice.error,
    };
  });
