-- 0024: clear the Security Advisor's SECURITY DEFINER warnings for real.
--
-- Lints `security_definer_function_executable_by_anon` and
-- `security_definer_function_executable_by_authenticated` flag six entries over
-- four functions: is_registration_open, list_open_campaigns, has_role and
-- update_own_profile. The Advisor cannot be silenced by revoking EXECUTE (the
-- app needs these), by moving them out of `public` (the client calls them over
-- /rest/v1/rpc) or by hiding the functions (RLS policies call two of them).
-- The only fix that keeps the app working is SECURITY INVOKER plus the exact
-- visibility each caller already has, through RLS instead of through bypass.
--
-- get_dashboard_stats is deliberately NOT converted: it is granted to
-- service_role only (so it is outside the Advisor's scope) and it aggregates
-- across every table precisely because it bypasses RLS.
--
-- Behaviour for the real callers is unchanged:
--   - anon/authenticated only ever saw open campaigns through the RPCs, and
--     with the policy in step 1 they see the same rows directly;
--   - every has_role caller is authenticated and asks about its own auth.uid();
--   - update_own_profile keeps its "own row, profile columns only" guarantee,
--     now from column-level grants rather than from DEFINER.
-- Only the SQL editor changes: it runs as postgres, so it now sees closed
-- campaigns through these functions too. That is a fact about the editor, not
-- about the app.
--
-- Idempotent: safe to re-run from the Supabase Dashboard SQL editor.

-- 0 · Re-state the visibility the conversion now depends on.
--     0023 found function grants had been revoked behind our back; if the
--     table grants or the own-row policy went the same way, the invoker
--     functions below would start denying the reads that used to come for
--     free from SECURITY DEFINER. All three statements are no-ops when
--     already in place.
GRANT SELECT ON public.registration_campaigns TO anon, authenticated;
GRANT SELECT ON public.user_roles TO authenticated;

DROP POLICY IF EXISTS "users read own roles" ON public.user_roles;
CREATE POLICY "users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 1 · Open campaigns readable by the roles that call the RPCs.
--     0006 created no SELECT policy on purpose (the DEFINER RPCs bypassed RLS,
--     and the table-level SELECT grant existed only for the INSERT policy).
--     With the functions running as the caller, RLS has to allow the read.
--     Permissive, so it ORs with "admins read campaigns": admins keep seeing
--     closed campaigns, everyone else sees open ones only, and only the
--     columns the public cards already render (the whole row, all benign).
DROP POLICY IF EXISTS "open campaigns are public" ON public.registration_campaigns;
CREATE POLICY "open campaigns are public" ON public.registration_campaigns
  FOR SELECT TO anon, authenticated
  USING (is_open = true);

-- 2 · list_open_campaigns() → SECURITY INVOKER.
--     Dropped and recreated rather than CREATE OR REPLACE: the RETURNS TABLE row
--     type comes from 0008, and OR REPLACE cannot change it if the live function
--     has drifted (a DROP would then be required anyway). The EXECUTE grants from
--     0006/0008/0023 are re-stated below so nothing is lost with the DROP.
DROP FUNCTION IF EXISTS public.list_open_campaigns();

CREATE FUNCTION public.list_open_campaigns()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  custom_questions jsonb,
  kind text,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT c.id, c.title, c.description, c.custom_questions, c.kind, c.created_at
  FROM public.registration_campaigns c
  WHERE c.is_open = true
  ORDER BY c.display_order ASC, c.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_campaigns() TO anon, authenticated;

-- 3 · is_registration_open(uuid) → SECURITY INVOKER.
--     Still runs inside the "anyone can register to an open campaign" INSERT
--     policy: the caller's own view of registration_campaigns (step 1) is what
--     decides, so a closed or unknown campaign yields NULL and the insert is
--     denied exactly as before.
CREATE OR REPLACE FUNCTION public.is_registration_open(target_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT is_open FROM public.registration_campaigns WHERE id = target_campaign_id;
$$;

-- 4 · has_role(uuid, app_role) → SECURITY INVOKER.
--     Every caller is authenticated: getAdminStatus / requireAdmin in
--     src/lib/admin-api.ts and the ~20 "admins ..." policies, all
--     `TO authenticated USING (has_role(auth.uid(), 'admin'))`. That role has
--     table-level SELECT on user_roles plus the "users read own roles" policy,
--     so an invoker read of the caller's own row is exactly the check.
--     No anon policy or anon-facing function calls it, so the missing anon
--     SELECT grant is never an error, and there is no recursion: no policy on
--     user_roles references has_role.
--     The only behaviour change tightens things: has_role about someone else's
--     user_id now answers false instead of reading their row.
--     service_role still works (ALL grant + BYPASSRLS), and any SECURITY
--     DEFINER caller would run it as postgres, which sees everything anyway.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- 5 · update_own_profile(text, text) → SECURITY INVOKER.
--     The DEFINER wrapper existed so the updater could not touch role,
--     admin_role or disabled_at. Column-level grants make that structural:
--     this role may UPDATE display_name and avatar_url only, and no
--     table-level UPDATE on user_roles exists to widen it.
DROP POLICY IF EXISTS "users update own profile" ON public.user_roles;
CREATE POLICY "users update own profile" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT UPDATE (display_name, avatar_url) ON public.user_roles TO authenticated;

CREATE OR REPLACE FUNCTION public.update_own_profile(p_display_name text, p_avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  UPDATE public.user_roles
     SET display_name = NULLIF(btrim(p_display_name), ''),
         avatar_url = NULLIF(btrim(p_avatar_url), '')
   WHERE user_id = auth.uid() AND role = 'admin';
END;
$$;

-- 6 · Verification.
--     Every function below should come back with security_definer = false,
--     except get_dashboard_stats (definer on purpose, service_role only).
SELECT p.proname,
       p.prosecdef AS is_security_definer,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_execute
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
 WHERE n.nspname = 'public'
   AND p.proname IN (
     'list_open_campaigns', 'is_registration_open',
     'has_role', 'update_own_profile', 'get_dashboard_stats'
   )
 ORDER BY p.proname;

--     New policy in place, and the closed-campaign admin policy untouched.
SELECT tablename, policyname, roles, cmd, qual
  FROM pg_policies
 WHERE schemaname = 'public'
   AND tablename IN ('registration_campaigns', 'user_roles')
 ORDER BY tablename, policyname;

--     Profile columns are updatable by authenticated, nothing else is.
SELECT grantee, column_name, privilege_type
  FROM information_schema.column_privileges
 WHERE table_schema = 'public' AND table_name = 'user_roles'
 ORDER BY grantee, column_name, privilege_type;
