-- 0012: interview check-in tracking on registrations.
-- Works for both membership and event campaign kinds — check-in is not kind-specific.
-- Idempotent: safe to re-run from the Supabase Dashboard.

ALTER TABLE public.registrations
  ADD COLUMN IF NOT EXISTS checked_in boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz;