-- 0023: restore the EXECUTE grants the public site and the admin console run on.
--
-- Found by probing with the publishable (anon) key after 0022: every custom
-- function came back `42501 permission denied for function …`, including the
-- two the public flow cannot work without:
--
--   list_open_campaigns()   ← the homepage resolves each card's campaign
--                             against this; without it EVERY public card
--                             renders the closed "Registration opening soon"
--                             state and no announcement can be applied to
--   is_registration_open()  ← called inside the RLS policy for INSERT into
--                             `registrations`, so an anonymous student's
--                             submit would fail even if the card opened
--
-- `has_role` and `update_own_profile` are the authenticated-side equivalents
-- (admin status check, profile edit). `get_dashboard_stats` is service-role
-- only, by design (see 0015/0016). GRANT is idempotent — re-running this
-- changes nothing once the rows are back.
--
-- The grants themselves are not new: 0006/0007/0008/0014/0021 already
-- declared them. Something revoked them from `anon` (and possibly from
-- `authenticated`) afterwards — this migration puts the documented state back.

GRANT EXECUTE ON FUNCTION public.list_open_campaigns() TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_registration_open(uuid) TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;

GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text) TO authenticated;

GRANT EXECUTE ON FUNCTION public.get_dashboard_stats(boolean, boolean, boolean, boolean)
  TO service_role;

-- Verification: every row below should show the grantee it is supposed to have.
-- `proacl` is NULL when the function still has default (PUBLIC) privileges.
SELECT p.proname AS function,
       p.proacl,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_run,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_run,
       has_function_privilege('service_role', p.oid, 'EXECUTE') AS service_role_can_run
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'list_open_campaigns',
    'is_registration_open',
    'has_role',
    'update_own_profile',
    'get_dashboard_stats'
  )
ORDER BY p.proname;
