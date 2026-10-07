// Server-only env accessors for the admin request flow.
// Import this ONLY via `await import()` from within server function handlers.
export function getOwnerEmail(): string {
  // VITE_OWNER_EMAIL is committed in .env and baked into the build by Vite, so
  // ownership detection keeps working on a raw Vercel deploy that lacks the
  // runtime OWNER_EMAIL override. `process.env` wins when present so operators
  // can still point ownership elsewhere.
  return (process.env["OWNER_EMAIL"] ?? import.meta.env["VITE_OWNER_EMAIL"] ?? "").toLowerCase();
}

export function getSigningSecret(): string {
  return process.env["ADMIN_REQUEST_SIGNING_SECRET"] ?? "dev-only-insecure-signing-secret";
}
