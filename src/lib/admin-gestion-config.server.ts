// Server-only env accessors for the admin request flow.
// Import this ONLY via `await import()` from within server function handlers.
export function getOwnerEmail(): string {
  return (process.env["OWNER_EMAIL"] ?? "").toLowerCase();
}

export function getSigningSecret(): string {
  return process.env["ADMIN_REQUEST_SIGNING_SECRET"] ?? "dev-only-insecure-signing-secret";
}
