-- 0025: close the hole 0024 opened on user_roles.
--
-- Found by 0024's own verification query. information_schema.column_privileges
-- expands a *table-level* grant across every column (PostgreSQL docs: "If a
-- privilege has been granted on an entire table, it will show up in this view
-- as a grant for each column"), so the output showing anon and authenticated
-- with INSERT/UPDATE/SELECT/REFERENCES on every column of user_roles means
-- Supabase's default privileges handed them the whole table. Migrations 0000
-- only ever granted SELECT to authenticated — the rest came along for the ride,
-- and RLS (no write policy at all) was the only thing holding them back.
--
-- 0024 then added the own-row UPDATE policy update_own_profile needs now that it
-- is SECURITY INVOKER. A policy plus a table-level UPDATE means an officer could
-- PATCH their own row: clear disabled_at after a revocation, or overwrite
-- admin_role. The column-level GRANT in 0024 does not prevent that — grants are
-- additive, and revoking the table-level UPDATE is what actually narrows it.
--
-- Every write to user_roles in the app already goes through supabaseAdmin
-- (ensureOwnerAdmin, ensureApprovedRequestRole, ensureAdminRoleGrant,
-- setAdminDisabled, deleteAdmin), so nothing legitimate is lost.
--
-- Same posture as everywhere else in this schema: RLS decides which rows,
-- grants decide which statements. This just makes the statements explicit.
--
-- Idempotent: safe to re-run from the Supabase Dashboard SQL editor.

REVOKE ALL ON public.user_roles FROM anon;
REVOKE ALL ON public.user_roles FROM authenticated;

-- What each caller actually needs:
--   anon          — nothing: no anon policy exists and no anon-facing function
--                   calls has_role();
--   authenticated — SELECT for has_role() (own row, via "users read own roles")
--                   and two profile columns for update_own_profile();
--   service_role  — untouched: every role grant / revocation in the app uses it.
GRANT SELECT ON public.user_roles TO authenticated;
GRANT UPDATE (display_name, avatar_url) ON public.user_roles TO authenticated;

-- Verification.

-- 1. Table-level DML must be gone for anon/authenticated: every UPDATE/INSERT
--    column below false, SELECT true only for authenticated. (service_role
--    stays true for everything — that is correct.)
SELECT grantee, table_name, privilege_type, is_grantable
  FROM information_schema.table_privileges
 WHERE table_schema = 'public' AND table_name = 'user_roles'
   AND grantee IN ('anon', 'authenticated', 'service_role')
 ORDER BY grantee, privilege_type;

-- 2. ...while the two profile columns stay updatable by authenticated.
--    Expected shape afterwards: anon -> no rows at all; authenticated ->
--    SELECT on every column (table grant) plus UPDATE on display_name and
--    avatar_url only (column grant); service_role -> all four types on every
--    column. Anything else on anon/authenticated means the grant was
--    column-level rather than table-level, and needs a matching
--    REVOKE <type> (col, ...) ON public.user_roles FROM <role>.
SELECT grantee, column_name, privilege_type
  FROM information_schema.column_privileges
 WHERE table_schema = 'public'
   AND table_name = 'user_roles'
   AND grantee IN ('anon', 'authenticated', 'service_role')
 ORDER BY grantee, column_name, privilege_type;

-- 3. One-shot answer for the table as a whole: false, false, true.
SELECT r.rolname,
       has_table_privilege(r.rolname, 'public.user_roles', 'INSERT')  AS can_insert,
       has_table_privilege(r.rolname, 'public.user_roles', 'UPDATE')  AS can_update,
       has_table_privilege(r.rolname, 'public.user_roles', 'DELETE')  AS can_delete,
       has_table_privilege(r.rolname, 'public.user_roles', 'SELECT')  AS can_select
  FROM pg_roles r
 WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
 ORDER BY r.rolname;

-- 4. And the policy set that now governs the table.
SELECT policyname, roles, cmd, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'user_roles'
 ORDER BY policyname;
