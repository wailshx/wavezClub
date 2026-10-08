// Server-only canonical origin for links handed to Supabase.
//
// Why this exists: GoTrue honours a `redirect_to` only when its origin appears
// under Authentication → URL Configuration → Redirect URLs. Anything else is
// silently replaced with the Site URL, and the single-use token is spent on the
// way. The failure is therefore quiet and looks like a broken link: the
// applicant lands on the site root instead of the page we asked for.
//
// Deriving the origin from the request is unsafe in production because the
// review link is opened from a phone over Telegram, so the host is whatever URL
// the owner happened to tap — the custom domain, or a hashed deployment URL.
// Only localhost is taken from the request, so local development still works.
//
// If the domain ever changes, this constant and the dashboard allowlist must be
// updated together. They are one setting in two places, and the allowlist is
// the half that fails without saying so.

export const CANONICAL_ORIGIN = "https://www.wave-z.club";

/**
 * The origin to build `redirectTo` values from.
 *
 * Localhost wins when present so `bun dev` keeps producing usable links;
 * everything else resolves to the canonical production origin rather than
 * trusting a request header that may not be on the allowlist.
 */
export async function resolveAppOrigin(): Promise<string> {
  const { getRequest } = await import("@tanstack/react-start/server");
  const request = getRequest();
  const proto = request?.headers.get("x-forwarded-proto") ?? "https";
  const host = request?.headers.get("x-forwarded-host") ?? request?.headers.get("host");
  if (host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host)) {
    return `${proto}://${host}`;
  }
  return CANONICAL_ORIGIN;
}
