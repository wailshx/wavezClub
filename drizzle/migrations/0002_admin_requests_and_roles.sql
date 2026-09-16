-- 0002: Admin request flow, role granularisation, owner auto-approve

-- New enum for specific admin roles
CREATE TYPE public.admin_role AS ENUM (
  'president',
  'vice_president',
  'media_leader',
  'vice_media_leader',
  'hr_leader',
  'vice_hr_leader'
);

-- Admin request form submissions (public can INSERT; owner SELECT/UPDATE via service_role)
CREATE TABLE public.admin_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  department public.admin_role NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz NOT NULL DEFAULT now(),
  decided_at timestamptz
);

GRANT INSERT ON public.admin_requests TO anon;
GRANT INSERT ON public.admin_requests TO authenticated;
GRANT ALL ON public.admin_requests TO service_role;
ALTER TABLE public.admin_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can submit admin request"
  ON public.admin_requests FOR INSERT TO anon, authenticated
  WITH CHECK (true);

-- Rate-limit public admin-request submissions (spam protection)
CREATE OR REPLACE FUNCTION public.rate_limit_admin_requests()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
    FROM public.admin_requests
    WHERE email = NEW.email AND created_at > now() - interval '60 seconds';
  IF recent_count > 0 THEN
    RAISE EXCEPTION 'You already submitted a request recently. Please wait before trying again.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rate_limit_admin_requests
BEFORE INSERT ON public.admin_requests
FOR EACH ROW EXECUTE FUNCTION public.rate_limit_admin_requests();

-- Extend user_roles with a specific admin_role column
ALTER TABLE public.user_roles ADD COLUMN admin_role public.admin_role;

-- Drop the old bootstrap trigger (replaced by app-level owner auto-approve)
DROP TRIGGER IF EXISTS on_auth_user_created_bootstrap_admin ON auth.users;
DROP FUNCTION IF EXISTS public.bootstrap_first_admin();
