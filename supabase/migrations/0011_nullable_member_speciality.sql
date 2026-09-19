-- 0011: relax members.speciality (and age) to be optional.
-- The acceptance flow for new members does not collect age or speciality yet, so
-- these columns must allow NULL (the registration form has no fields for them).
-- Idempotent: only drops NOT NULL when it is still set.
-- Also guards age, so environments where the earlier relaxation was skipped are fixed.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members'
      AND column_name = 'speciality' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.members ALTER COLUMN speciality DROP NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members'
      AND column_name = 'age' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE public.members ALTER COLUMN age DROP NOT NULL;
  END IF;
END $$;