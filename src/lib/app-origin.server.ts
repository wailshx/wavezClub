// Server-only canonical origin for links handed to Supabase.

import { getSiteUrl } from "./site-url.server";

export const CANONICAL_ORIGIN = getSiteUrl();

/**
 * The origin to build `redirect_to` values from.
 *
 * Never use VERCEL_URL or request origin. Use getSiteUrl() as specified.
 */
export async function resolveAppOrigin(): Promise<string> {
  return getSiteUrl();
}
