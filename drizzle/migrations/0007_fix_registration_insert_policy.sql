-- 0007: Fix registrations INSERT policy — subqueries in policy expressions are
-- subject to the referenced table's RLS, so an anon INSERT could never "see" an
-- open campaign. Check openness via a SECURITY DEFINER helper instead.

-- SECURITY DEFINER (owner = postgres, superuser, bypasses RLS on registration_campaigns).
CREATE OR REPLACE FUNCTION public.is_registration_open(target_campaign_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT is_open FROM public.registration_campaigns WHERE id = target_campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.is_registration_open(uuid) TO anon, authenticated;

-- Replace the failing policy with one that uses the helper.
DROP POLICY IF EXISTS "anyone can register to an open campaign" ON public.registrations;

CREATE POLICY "anyone can register to an open campaign" ON public.registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (public.is_registration_open(campaign_id));