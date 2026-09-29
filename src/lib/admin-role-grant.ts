// Officer-role granting, shared by both ways an admin request gets accepted.
//
// There are two accept paths -- the emailed review link
// (`decideAdminRequestAction`) and the console's Admins tab
// (`decideAdminRequest`) -- and they used to disagree about where the grant
// went. The console wrote `user_roles`, which is what `has_role()` reads. The
// review link wrote `admin_requests`, a table that has no `user_id`, `role` or
// `admin_role` column at all: that write failed, its error was discarded, and
// the officer could set a password and sign in but was not an officer.
//
// Both paths now go through `ensureAdminRoleGrant` so they cannot drift again.

type MutateResult = { error: { message: string } | null };
type SelectResult = {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
};
type SelectChain = {
  eq(column: string, value: unknown): SelectChain;
} & PromiseLike<SelectResult>;
type RolesTable = {
  select(columns: string): SelectChain;
  insert(row: Record<string, unknown>): Promise<MutateResult>;
};
type LooseDb = { from(table: string): RolesTable };

function userRolesTable(client: unknown): RolesTable {
  return (client as unknown as LooseDb).from("user_roles");
}

/**
 * Idempotently give `userId` the officer role with the requested `adminRole`.
 *
 * Reads before it writes because `(user_id, role)` is unique, and because an
 * existing row must be respected: revoking an officer sets `disabled_at` rather
 * than deleting the row, so an existence check is what stops a re-grant from
 * quietly undoing a revocation.
 *
 * Filters on `role = 'admin'`, not just `user_id`. A person can hold a
 * non-admin `user_roles` row (a member), and matching on `user_id` alone would
 * conclude they were already an officer and skip the grant.
 */
export async function ensureAdminRoleGrant(
  client: unknown,
  opts: { userId: string; adminRole: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const roles = userRolesTable(client);

  const { data: existing, error: readError } = await roles
    .select("id")
    .eq("user_id", opts.userId)
    .eq("role", "admin");
  if (readError) return { ok: false, error: readError.message };
  if ((existing ?? []).length > 0) return { ok: true };

  const { error } = await roles.insert({
    user_id: opts.userId,
    role: "admin",
    admin_role: opts.adminRole,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
