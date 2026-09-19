-- 0010: membership registration documents — school certificate + identity card.
-- Files are stored in a PRIVATE bucket; admins view them only through short-lived
-- signed URLs generated server-side (never a public, permanent URL).
-- Idempotent: safe to re-run from the Supabase Dashboard.

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS school_certificate_url text,
  ADD COLUMN IF NOT EXISTS identity_card_url text;

-- Private bucket — anon/authenticated may upload during registration, admins only may read.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'identity-documents',
  'identity-documents',
  false,
  5242880,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "anyone uploads registration documents" ON storage.objects;
CREATE POLICY "anyone uploads registration documents" ON storage.objects
  FOR INSERT TO anon, authenticated
  WITH CHECK (bucket_id = 'identity-documents');

DROP POLICY IF EXISTS "admins read registration documents" ON storage.objects;
CREATE POLICY "admins read registration documents" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'identity-documents' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update registration documents" ON storage.objects;
CREATE POLICY "admins update registration documents" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'identity-documents' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'identity-documents' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete registration documents" ON storage.objects;
CREATE POLICY "admins delete registration documents" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'identity-documents' AND public.has_role(auth.uid(), 'admin'));