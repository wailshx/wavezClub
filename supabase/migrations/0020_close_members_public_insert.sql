-- 0020: stop anonymous clients creating member rows.
--
-- Migration 0000 granted anon a direct INSERT into members so the old public
-- join form could write a row. That form is gone: a member is now created only
-- when a leader accepts a membership submission (acceptRegistration).
--
-- Dropping the policy alone would have BROKEN acceptRegistration. The server
-- functions use the caller's own JWT with the publishable key, not the
-- service-role key (see src/integrations/supabase/auth-middleware.ts), so RLS
-- is enforced on that insert -- and "anyone can apply" was the only policy
-- permitting it. It was the thing making acceptance work, not merely a
-- leftover. So it gets replaced, not just removed.
--
-- The replacement matches how team_members (0009) and registration_campaigns
-- (0006) already gate writes. has_role reads user_roles.role = 'admin', which
-- is the same column loadSessionAccess filters on for isAdmin, so this admits
-- exactly the officers who can reach acceptRegistration and nobody else. The
-- finer-grained section check stays in application code via requireAnySection.

DROP POLICY IF EXISTS "anyone can apply" ON public.members;

CREATE POLICY "admins insert members" ON public.members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Redundant once no policy admits anon, and dropping it means a future policy
-- cannot quietly re-open this. The authenticated grant must stay: admins need
-- it, and it is the same grant that carries SELECT/UPDATE/DELETE.
REVOKE INSERT ON public.members FROM anon;

-- Verification: the only INSERT policy left should be "admins insert members".
SELECT policyname, cmd, roles, qual, with_check
  FROM pg_policies
 WHERE schemaname = 'public' AND tablename = 'members'
 ORDER BY cmd, policyname;
