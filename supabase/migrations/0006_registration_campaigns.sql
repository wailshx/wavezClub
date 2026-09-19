-- 0006: Dynamic registration campaigns (supersedes the static "Become a member" flow)
-- Admins create campaigns (e.g. "Hackathon 2026", "General Membership Drive"); the public
-- can register into a currently-open campaign and admins review/accept submissions.

CREATE TABLE public.registration_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_open boolean NOT NULL DEFAULT false,
  custom_questions jsonb NOT NULL DEFAULT '[]'::jsonb
    CHECK (jsonb_typeof(custom_questions) = 'array'),
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Base SELECT grant lets the registrations INSERT policy (below) verify the campaign
-- is open, but no SELECT policy is created: direct anon reads are blocked by RLS.
GRANT SELECT ON public.registration_campaigns TO anon, authenticated;
GRANT ALL ON public.registration_campaigns TO service_role;
ALTER TABLE public.registration_campaigns ENABLE ROW LEVEL SECURITY;

-- Only club officers (has_role 'admin') can manage campaigns.
CREATE POLICY "admins create campaigns" ON public.registration_campaigns
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins read campaigns" ON public.registration_campaigns
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update campaigns" ON public.registration_campaigns
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete campaigns" ON public.registration_campaigns
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Registrations: public INSERT only into an *open* campaign; admins review/update.
CREATE TABLE public.registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL
    REFERENCES public.registration_campaigns(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  department text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  school_year public.study_level NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb
    CHECK (jsonb_typeof(answers) = 'object'),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'accepted', 'removed')),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.registrations TO anon, authenticated;
GRANT ALL ON public.registrations TO service_role;
ALTER TABLE public.registrations ENABLE ROW LEVEL SECURITY;

-- Public can only register into a campaign that is currently open. The subquery is
-- not subject to the campaign table's RLS, but anon's SELECT grant above is required.
CREATE POLICY "anyone can register to an open campaign" ON public.registrations
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.registration_campaigns rc
      WHERE rc.id = campaign_id AND rc.is_open = true
    )
  );

-- Reviewed by club officers only; the public never reads registrations.
CREATE POLICY "admins read registrations" ON public.registrations
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update registrations" ON public.registrations
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete registrations" ON public.registrations
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Spam protection: one registration per email per campaign per 60 seconds.
CREATE OR REPLACE FUNCTION public.rate_limit_registrations()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE recent_count integer;
BEGIN
  SELECT count(*) INTO recent_count
    FROM public.registrations
    WHERE campaign_id = NEW.campaign_id
      AND email = NEW.email
      AND created_at > now() - interval '60 seconds';
  IF recent_count > 0 THEN
    RAISE EXCEPTION 'You already applied to this campaign recently. Please wait about a minute and try again.';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_rate_limit_registrations
BEFORE INSERT ON public.registrations
FOR EACH ROW EXECUTE FUNCTION public.rate_limit_registrations();

CREATE INDEX registrations_campaign_email_time_idx
  ON public.registrations (campaign_id, email, created_at);

CREATE INDEX registrations_campaign_status_idx
  ON public.registrations (campaign_id, status, created_at);

-- Public (anon) read: open campaigns only, limited safe fields, via RPC (no table grant leak).
CREATE OR REPLACE FUNCTION public.list_open_campaigns()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  custom_questions jsonb,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.title, c.description, c.custom_questions, c.created_at
  FROM public.registration_campaigns c
  WHERE c.is_open = true
  ORDER BY c.display_order ASC, c.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_campaigns() TO anon, authenticated;

-- Accepted registrations become rows in `members`, but registrations don't capture
-- age or speciality, so relax those two columns (CHECKs already allow NULL).
ALTER TABLE public.members ALTER COLUMN age DROP NOT NULL;
ALTER TABLE public.members ALTER COLUMN speciality DROP NOT NULL;