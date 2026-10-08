import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { ensureAdminRoleGrant } from "@/lib/admin-role-grant";
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

/** Roles available on the public request form — the club's three leadership
 * seats. The vice_* variants exist in the enum but are not offered: an
 * applicant is applying to lead a department, not to deputise for it. */
export const SUBMITTABLE_ADMIN_ROLES = ["president", "media_leader", "hr_leader"] as const;

export type SubmittableAdminRole = (typeof SUBMITTABLE_ADMIN_ROLES)[number];

export const DEPARTMENT_LABELS: Record<SubmittableAdminRole, string> = {
  president: "President",
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
};

type AdminRequestsSelectChain = {
  eq(column: string, value: string): AdminRequestsWhereChain;
  order(column: string, opts: { ascending: boolean }): AdminRequestsWhereChain;
};

type AdminRequestsWhereChain = {
  eq(column: string, value: string): AdminRequestsWhereChain;
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

/**
 * The origin every link we hand to Supabase is built from.
 *
 * Deliberately not the request host: see `app-origin.server.ts` for why an
 * off-allowlist origin costs the applicant their single-use token.
 */
async function getBaseUrl(): Promise<string> {
  const { getSiteUrl } = await import("@/lib/site-url.server");
  return getSiteUrl();
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
    const { getSigningSecret } = await import("@/lib/admin-gestion-config.server");
    const db = supabaseAdmin as unknown as TypedAdmin;
    const origin = await getBaseUrl();

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
          `no review link was sent. Find it in admin_requests and review manually.`,
      );
      return { ok: true as const, requestId: null, ownerNotified: false };
    }

    const reviewUrl = `${origin}/gestion/review/${await signReviewToken(getSigningSecret(), newRow.id)}`;
    // The insert must not fail because the alert did, but the request is STRANDED
    // if it is lost: /gestion/review/$token is the only approval path, so nothing
    // can be approved until the owner has that link. Surface the failure loudly and
    // hand the applicant a reference they can quote.
    //
    // This is a Telegram push, not email. The owner watches the club chat, and an
    // officer application is time-sensitive in a way club mail is not. Applicant-
    // facing messages (the accept/cancel stub, rejections) still go out over
    // Resend -- deliberately unchanged.
    const { sendTelegramMessage, escapeHtml } = await import("@/lib/telegram.server");
    const alert = await sendTelegramMessage(
      [
        "<b>New admin request — Wavez Club</b>",
        "",
        `<b>Name:</b> ${escapeHtml(data.firstName)} ${escapeHtml(data.lastName)}`,
        `<b>Role requested:</b> ${escapeHtml(data.department)}`,
        `<b>Email:</b> ${escapeHtml(data.email)}`,
        `<b>Phone:</b> ${escapeHtml(data.phone)}`,
        "",
        "Review and decide:",
        escapeHtml(reviewUrl),
        "",
        "<i>Approve or reject from the console: Admins tab → Pending applications.</i>",
      ].join("\n"),
    );
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
    const { data: userData, error: userError } = await context.supabase.auth.getUser();
    if (userError) {
      console.error("[ensureOwnerAdmin] getUser error", {
        userId: context.userId,
        error: userError.message,
      });
      return false;
    }
    const email = userData?.user?.email?.toLowerCase();
    const ownerEmail = getOwnerEmail();
    const ownerMatch = Boolean(email && ownerEmail && email === ownerEmail);
    if (!email || !ownerMatch) {
      console.log("[ensureOwnerAdmin] skip (not owner or no email)", {
        userId: context.userId,
        hasEmail: Boolean(email),
        ownerMatch,
      });
      return false;
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: existingError } = (await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle()) as unknown as {
      data: { id: string } | null;
      error?: { message: string } | null;
    };
    if (existingError) {
      console.error("[ensureOwnerAdmin] existing check error", {
        userId: context.userId,
        error: existingError.message,
      });
      return false;
    }

    if (existing) {
      console.log("[ensureOwnerAdmin] owner already has admin role", { userId: context.userId });
      return true;
    }

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
      console.error("[ensureOwnerAdmin] insert failed", {
        userId: context.userId,
        error: error.message,
      });
      return false;
    }
    console.log("[ensureOwnerAdmin] granted president role to owner", { userId: context.userId });
    return true;
  });

/**
 * Give the caller the officer role their approved request already entitled them
 * to, when the role row is missing.
 *
 * Accept via the emailed review link used to write the grant to the wrong table,
 * so anyone approved that way before the fix has no `user_roles` row: they can
 * set a password and sign in, but every check answers "Not a club officer".
 * `admin_requests` has no `user_id`, so the only link back is the email -- which
 * is safe to trust here because it comes from the caller's own verified session,
 * so this can only ever re-grant a role the club already approved.
 */
export const ensureApprovedRequestRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: userData } = await context.supabase.auth.getUser();
    const email = userData?.user?.email?.toLowerCase();
    if (!email) return false;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Already an officer -> nothing to do. A disabled officer keeps their row,
    // so this is also what stops a revocation from being silently undone.
    const { data: existing } = (await supabaseAdmin
      .from("user_roles")
      .select("id")
      .eq("user_id", context.userId)
      .eq("role", "admin")
      .maybeSingle()) as unknown as { data: { id: string } | null };
    if (existing) return true;

    const db = supabaseAdmin as unknown as TypedAdmin;
    const { data: approved, error } = await db
      .from("admin_requests")
      .select("department")
      .eq("email", email)
      .eq("status", "approved")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    if (error || !approved) return false;

    const grant = await ensureAdminRoleGrant(supabaseAdmin, {
      userId: context.userId,
      adminRole: approved.department,
    });
    if (!grant.ok) {
      console.error(
        `[admin-role] self-heal grant failed for ${email} userId=${context.userId}: ${grant.error}`,
      );
      return false;
    }

    console.log(
      `[admin-role] repaired missing role: granted ${approved.department} to ${email} from an approved request`,
    );
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
        console.error(
          `[admin-request] auth user already exists for requestId=${decoded.requestId} ` +
            `email=${request.email}; sending password recovery link via Resend as fallback.`,
        );
      } else {
        // Generate invite link ourselves and send via Resend (no reliance on Supabase SMTP)
        const inviteGen = await admin.generateLink({
          type: "invite",
          email: request.email,
          options: { redirectTo: `${await getBaseUrl()}/gestion/set-password` },
        });
        console.error(
          `[admin-request] generateLink(type=invite) called for requestId=${decoded.requestId} ` +
            `email=${request.email} ok=${inviteGen.error ? "false" : "true"} ` +
            `error=${inviteGen.error ? inviteGen.error.message : "none"} ` +
            `status=${inviteGen.error ? inviteGen.error.status : "ok"}`,
        );
        if (inviteGen.error) {
          throw new Error(`Invite failed: ${inviteGen.error.message}`);
        }

        const { data: afterInvite } = await admin.listUsers({ perPage: 1000 });
        const invited = afterInvite?.users.find(
          (u) => u.email?.toLowerCase() === request.email.toLowerCase(),
        );
        userId = invited?.id;
      }

      if (!userId) throw new Error("Could not resolve the user account.");

      // Grant the role *before* marking the request approved. `has_role()`
      // reads user_roles, so a failed grant must leave the request pending and
      // retryable rather than approved-but-roleless -- which is how an officer
      // could set a password, sign in, and still be told "Not a club officer".
      const grant = await ensureAdminRoleGrant(db, {
        userId,
        adminRole: request.department,
      });
      if (!grant.ok) {
        console.error(
          `[admin-request] ROLE GRANT FAILED for requestId=${decoded.requestId} ` +
            `userId=${userId} error=${grant.error}. Request left pending.`,
        );
        throw new Error(`Could not grant the officer role: ${grant.error}`);
      }

      await db
        .from("admin_requests")
        .update({ status: "approved", decided_at: new Date().toISOString() })
        .eq("id", decoded.requestId);

      // The account now exists and carries the role, but the officer still has
      // no password and cannot sign in. Getting them the link is a *separate*
      // delivery problem: GoTrue's own mailer cannot be trusted with it (without
      // custom SMTP it is a development stub that only reaches team members, and
      // the drop is not reported, because the *user* was created), and the club's
      // Resend account is in test mode until a domain is verified, where it only
      // accepts the account owner's own address. So the link is generated here
      // and returned to the caller as well as mailed: while delivery is broken
      // the owner can still pass it on over Telegram, which is how the club
      // already talks.
      const { buildSetPasswordLink, sendSetPasswordInvite } =
        await import("@/lib/admin-invite-link.server");
      const { sendClubEmail } = await import("@/lib/resend.server");
      const setPasswordUrl = `${await getBaseUrl()}/gestion/set-password`;
      let built: { link: string } | { error: string };

      if (existing?.id) {
        // Existing auth user - send password recovery link
        const rec = await admin.generateLink({
          type: "recovery",
          email: request.email,
          options: { redirectTo: setPasswordUrl },
        });
        const link = rec.data?.properties?.action_link;
        if (rec.error || !link) {
          const err = rec.error?.message || "Could not generate recovery link";
          console.error(
            `[admin-request] RECOVERY LINK FAILED for requestId=${decoded.requestId} ` +
              `email=${request.email} error=${err}. Request is approved but the officer ` +
              `cannot sign in until a link is generated by hand.`,
          );
          return {
            ok: true as const,
            action: "accept" as const,
            email: request.email,
            emailSent: false,
            emailError: err,
          };
        }
        built = { link };
        const sent = await sendClubEmail({
          to: request.email,
          subject: "You've been accepted to Wavez Club — set your password",
          text: [
            `Hi ${request.first_name},`,
            "",
            "Your application to join the Wavez Club officer team has been approved.",
            "",
            "Use the link below to set/reset your password:",
            link,
            "",
            "— Wavez Club",
          ].join("\n"),
        });
        if (!sent.ok) {
          console.error(
            `[admin-request] WELCOME EMAIL FAILED for requestId=${decoded.requestId} ` +
              `email=${request.email} error=${sent.error}`,
          );
        }
        return {
          ok: true as const,
          action: "accept" as const,
          email: request.email,
          emailSent: sent.ok,
          emailError: sent.ok ? undefined : sent.error,
          setPasswordLink: link,
        };
      } else {
        built = await buildSetPasswordLink(admin, request.email, setPasswordUrl);
        if ("error" in built) {
          console.error(
            `[admin-request] SET-PASSWORD LINK FAILED for requestId=${decoded.requestId} ` +
              `email=${request.email} error=${built.error}. Request is approved but the officer ` +
              `cannot sign in until a link is generated by hand.`,
          );
          return {
            ok: true as const,
            action: "accept" as const,
            email: request.email,
            emailSent: false,
            emailError: built.error,
          };
        }
        const welcome = await sendSetPasswordInvite({
          to: request.email,
          name: request.first_name,
          link: built.link,
        });
        if (!welcome.ok) {
          console.error(
            `[admin-request] WELCOME EMAIL FAILED for requestId=${decoded.requestId} ` +
              `email=${request.email} error=${welcome.error}. Request is approved but the officer ` +
              `has not been told; share the link from this page instead.`,
          );
        }
        return {
          ok: true as const,
          action: "accept" as const,
          email: request.email,
          emailSent: welcome.ok,
          emailError: welcome.ok ? undefined : welcome.error,
          setPasswordLink: built.link,
        };
      }
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
