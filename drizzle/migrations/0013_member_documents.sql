-- Carry membership document references from `registrations` onto `members` when
-- an admin accepts a membership submission.

ALTER TABLE public.members
  ADD COLUMN IF NOT EXISTS school_certificate_url text,
  ADD COLUMN IF NOT EXISTS identity_card_url text;