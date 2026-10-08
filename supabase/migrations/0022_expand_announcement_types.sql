-- 0022: Announcements grow from two submission types to four.
--
-- NOT YET APPLIED. Paste this into the Supabase SQL Editor (project
-- pnqdtozfqzvybewuabwc) before deploying the build that depends on it — the
-- admin form now writes `opens_at`, which does not exist until step 2 runs.
--
-- One announcement now moves through a lifecycle instead of being born as a
-- submission and staying one:
--
--   openday      — membership campaign, 3-step wizard with documents
--   event        — event campaign, single-step form
--   announcement — information only: no form, no call to action
--   soon         — teaser card, no form yet, optional `opens_at` date
--
-- `submission_type` is plain text with a CHECK constraint (0016), not an enum,
-- so extending it means dropping the old CHECK and adding a wider one.

-- 1 · Widen the CHECK. The 0016 constraint was added unnamed, so it is found by
--     its definition text rather than by guessing Postgres' generated name.
--     The whole step is skipped on a re-run (a constraint that already allows
--     'announcement' means this migration has been applied).
DO $$
DECLARE
  con text;
  already_applied boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%announcement%'
  ) INTO already_applied;

  IF already_applied THEN
    RETURN;
  END IF;

  FOR con IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'public.posts'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) ILIKE '%submission_type%'
  LOOP
    EXECUTE format('ALTER TABLE public.posts DROP CONSTRAINT %I', con);
  END LOOP;

  ALTER TABLE public.posts
    ADD CONSTRAINT posts_submission_type_check
    CHECK (submission_type IN ('openday', 'event', 'announcement', 'soon'));
END
$$;

-- 2 · When a 'soon' teaser opens. Nullable: only that type uses it, and it is
--     optional there. The admin form writes it, the public card reads it.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS opens_at timestamptz;

-- 3 · Backfill. A row with no campaign never had a form, so it was an
--     information announcement waiting to exist — make that explicit.
--     Rows that point at a campaign keep 'openday' / 'event' untouched.
--     Idempotent: once converted the WHERE clause no longer matches.
UPDATE public.posts
SET submission_type = 'announcement'
WHERE campaign_id IS NULL
  AND submission_type IN ('openday', 'event');

-- 4 · Verification — both SELECTs are safe to re-run by hand after migrating.
SELECT submission_type, count(*) AS posts
FROM public.posts
GROUP BY submission_type
ORDER BY submission_type;

-- Any row outside the four values would have failed step 1; this lists what the
-- backfill converted, so an operator can eyeball it before going live.
SELECT id, title, submission_type, campaign_id, opens_at
FROM public.posts
WHERE submission_type IN ('announcement', 'soon')
ORDER BY created_at DESC;
