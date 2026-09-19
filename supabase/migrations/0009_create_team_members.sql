-- 0009: Our Mentors & Community — faculty / administration / notable students
-- Shown on the homepage directly below "Leaders"; only admin role users can manage them.
-- Idempotent so it can be re-run safely from the Supabase Dashboard.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'team_category') THEN
    CREATE TYPE public.team_category AS ENUM ('student', 'professor', 'administration');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role_title text NOT NULL,
  category public.team_category NOT NULL DEFAULT 'professor',
  avatar_url text NOT NULL,
  linkedin_url text,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.team_members TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_members TO authenticated;
GRANT ALL ON public.team_members TO service_role;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Public site can read every team member (homepage "Our Mentors & Community").
DROP POLICY IF EXISTS "anyone reads team members" ON public.team_members;
CREATE POLICY "anyone reads team members" ON public.team_members
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only club officers (has_role 'admin') can manage team members.
DROP POLICY IF EXISTS "admins insert team members" ON public.team_members;
CREATE POLICY "admins insert team members" ON public.team_members
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update team members" ON public.team_members;
CREATE POLICY "admins update team members" ON public.team_members
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete team members" ON public.team_members;
CREATE POLICY "admins delete team members" ON public.team_members
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX IF NOT EXISTS team_members_display_order_idx ON public.team_members (display_order, created_at);

-- Storage bucket for member avatars (public read).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'team',
  'team',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anyone reads team photos" ON storage.objects;
CREATE POLICY "anyone reads team photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'team');

DROP POLICY IF EXISTS "admins upload team photos" ON storage.objects;
CREATE POLICY "admins upload team photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'team' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update team photos" ON storage.objects;
CREATE POLICY "admins update team photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'team' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'team' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete team photos" ON storage.objects;
CREATE POLICY "admins delete team photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'team' AND public.has_role(auth.uid(), 'admin'));