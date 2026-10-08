// Server-only site URL helper as specified by the user.
//
// Reads SITE_URL from env (must be set in production) and falls back to the
// exact deployment URL given: https://wavez-club-p2b4.vercel.app
// Never use VERCEL_URL or request origin.

const FALLBACK_SITE_URL = "https://wavez-club-p2b4.vercel.app";

export function getSiteUrl(): string {
  const siteUrl = process.env["SITE_URL"];
  if (typeof siteUrl === "string" && siteUrl.trim().length > 0) {
    return siteUrl.trim();
  }
  return FALLBACK_SITE_URL;
}

export async function getSiteUrlAsync(): Promise<string> {
  return getSiteUrl();
}
