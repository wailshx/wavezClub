-- 0008: campaign kind — membership drive vs event sign-up.
-- Accepting a submission creates a club member ONLY for membership campaigns.
-- For event campaigns, accepting just registers participation (no Members row).
-- Idempotent: safe on fresh databases and databases already partially migrated.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'registration_campaigns'
      AND column_name = 'kind'
  ) THEN
    ALTER TABLE public.registration_campaigns
      ADD COLUMN kind text NOT NULL DEFAULT 'membership'
      CHECK (kind IN ('membership', 'event'));
  END IF;
END $$;

-- Surface `kind` through the public open-campaign RPC so cards can label it.
-- (Changing the RETURNS TABLE row type requires dropping the function first.)
DROP FUNCTION IF EXISTS public.list_open_campaigns();

CREATE FUNCTION public.list_open_campaigns()
RETURNS TABLE (
  id uuid,
  title text,
  description text,
  custom_questions jsonb,
  kind text,
  created_at timestamptz
) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.title, c.description, c.custom_questions, c.kind, c.created_at
  FROM public.registration_campaigns c
  WHERE c.is_open = true
  ORDER BY c.display_order ASC, c.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_open_campaigns() TO anon, authenticated;