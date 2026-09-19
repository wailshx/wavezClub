-- 0005: Public club leadership board ("Meet our team")
-- Leaders are shown on the public site; only admin role users can manage them.

CREATE TABLE public.leaders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  description text NOT NULL DEFAULT '',
  image_url text NOT NULL,
  display_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.leaders TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leaders TO authenticated;
GRANT ALL ON public.leaders TO service_role;
ALTER TABLE public.leaders ENABLE ROW LEVEL SECURITY;

-- Public site can read every leader (carousel on the homepage).
CREATE POLICY "anyone reads leaders" ON public.leaders
  FOR SELECT TO anon, authenticated
  USING (true);

-- Only club officers (has_role 'admin') can manage leaders.
CREATE POLICY "admins insert leaders" ON public.leaders
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update leaders" ON public.leaders
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete leaders" ON public.leaders
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX leaders_display_order_idx ON public.leaders (display_order, created_at);

-- Storage bucket for leader photos (public read).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'leaders',
  'leaders',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "anyone reads leader photos" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'leaders');

CREATE POLICY "admins upload leader photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'leaders' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins update leader photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'leaders' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'leaders' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete leader photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'leaders' AND public.has_role(auth.uid(), 'admin'));