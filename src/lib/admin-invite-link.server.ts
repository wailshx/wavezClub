// Server-only: build and deliver the "choose your password" link for an officer.
//
// Extracted because two call sites need it and the email path is not optional:
// the club's Resend account is in test mode until a domain is verified, and in
// that state Resend only accepts the account owner's own address as a
// recipient. Any applicant-facing mail therefore fails, and for a club that
// already coordinates over Telegram, "the officer gets the link some other way"
// has to be a first-class path rather than a manual workaround nobody can
// perform. Callers are expected to surface the link itself so the owner can pass
// it along however they like.

import type { GoTrueAdminApi as AuthAdminApi } from "@supabase/auth-js";

/**
 * Build a link the officer can use to set their own password.
 *
 * `generateLink` produces the link GoTrue's own invite email would have carried
 * without asking GoTrue to send it. Prefers an invite link (the flow the account
 * was created for) and falls back to a magic link, which also works for an
 * account that already exists. Both carry a live session in the URL hash, which
 * is what /gestion/set-password consumes.
 */
export async function buildSetPasswordLink(
  admin: AuthAdminApi,
  email: string,
  redirectTo: string,
): Promise<{ link: string } | { error: string }> {
  let lastError = "no action_link returned";
  for (const type of ["invite", "magiclink"] as const) {
    const { data, error } = await admin.generateLink({ type, email, options: { redirectTo } });
    const link = data?.properties?.action_link;
    if (!error && link) return { link };
    if (error) lastError = error.message;
  }
  return { error: lastError };
}

/**
 * Mail the link through the club's own Resend account.
 *
 * Never throws: a failed send must not undo an approval that already happened.
 * Callers hand the link back to the owner regardless of the outcome, because
 * with no verified domain this returns `ok: false` for every real applicant.
 */
export async function sendSetPasswordInvite(opts: {
  to: string;
  name?: string | null;
  link: string;
}): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { sendClubEmail } = await import("@/lib/resend.server");
  const greeting = opts.name ? `Hi ${opts.name},` : "Hi,";
  return sendClubEmail({
    to: opts.to,
    subject: "Welcome to the Wavez Club team — set your password",
    text: [
      greeting,
      "",
      "Your application to join the Wavez Club officer team has been approved.",
      "",
      "Choose a password for your account using the link below:",
      opts.link,
      "",
      "The link signs you in and opens the page where you set your password.",
      "",
      "— Wavez Club",
    ].join("\n"),
  });
}
