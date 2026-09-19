-- 0014: Self-service admin profiles + per-section admin permissions (owner-managed).
-- Idempotent: safe to re-run from the Supabase Dashboard.

-- Profile identity + soft-disable live on the approved-admin row itself.
ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS disabled_at timestamptz;

-- An admin updates ONLY their own display name / avatar. SECURITY DEFINER so the
-- updater never touches role, admin_role or disabled_at, and non-admins have no row.
CREATE OR REPLACE FUNCTION public.update_own_profile(p_display_name text, p_avatar_url text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.user_roles
     SET display_name = NULLIF(btrim(p_display_name), ''),
         avatar_url = NULLIF(btrim(p_avatar_url), '')
   WHERE user_id = auth.uid() AND role = 'admin';
END;
$$;
GRANT EXECUTE ON FUNCTION public.update_own_profile(text, text) TO authenticated;

-- Per-section access. An ABSENT row means full access (grandfathers every existing
-- admin). The owner writes a granted=false row only when explicitly restricting.
CREATE TABLE IF NOT EXISTS public.admin_permissions (
  user_id uuid NOT NULL,
  section text NOT NULL,
  granted boolean NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, section)
);
GRANT SELECT ON public.admin_permissions TO authenticated;
GRANT ALL ON public.admin_permissions TO service_role;
ALTER TABLE public.admin_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users read own permissions" ON public.admin_permissions;
CREATE POLICY "users read own permissions" ON public.admin_permissions
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Public admin-avatar bucket (PNG/JPG/WebP, 5 MB), readable by anyone so the
-- sidebar <img> loads without a signed URL.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'admin-avatars',
  'admin-avatars',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public read admin avatars" ON storage.objects;
CREATE POLICY "public read admin avatars" ON storage.objects
  FOR SELECT TO public USING (bucket_id = 'admin-avatars');

DROP POLICY IF EXISTS "admins upload admin avatars" ON storage.objects;
CREATE POLICY "admins upload admin avatars" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'admin-avatars' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins update admin avatars" ON storage.objects;
CREATE POLICY "admins update admin avatars" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'admin-avatars' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'admin-avatars' AND public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "admins delete admin avatars" ON storage.objects;
CREATE POLICY "admins delete admin avatars" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'admin-avatars' AND public.has_role(auth.uid(), 'admin'));