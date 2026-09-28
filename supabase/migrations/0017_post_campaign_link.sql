-- 0017: link each announcement to the campaign it announces.
--
-- An announcement used to be a generic pointer at the homepage registration
-- section. It is now the only entry point: its "Submit" button must land on the
-- registration page of ONE specific campaign, because the two submission kinds
-- ask for different things —
--   * openday  → membership wizard (profile, school certificate, ID card, questions)
--   * event    → single-step details form
-- so a single shared "register here" target could not honour either.
--
-- `campaign_id` is nullable so an announcement can be written before its
-- campaign exists; the public card then shows a "not open yet" state instead of
-- a dead link. Deleting a campaign clears the link rather than deleting the
-- announcement.
--
-- Idempotent by design: this file may be re-applied safely.
ALTER TABLE public.posts
  ADD COLUMN IF NOT EXISTS campaign_id uuid
  REFERENCES public.registration_campaigns(id) ON DELETE SET NULL;

-- The public feed filters published posts and the admin filters by campaign.
CREATE INDEX IF NOT EXISTS posts_campaign_id_idx ON public.posts (campaign_id);
