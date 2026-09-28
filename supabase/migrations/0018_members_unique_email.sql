-- 0018: one member row per email address.
--
-- Accepting a submission writes a `members` row, and the same person can apply
-- to an open day AND an event with one address. Without a unique index both
-- accepts succeed and the club ends up with duplicate members. The application
-- now checks for this before accepting, but the database is what actually
-- guarantees it — a check in app code is a courtesy, a constraint is a rule.
--
-- Compared case-insensitively, because "Ali@x.com" and "ali@x.com" are the same
-- person. Idempotent: safe on a fresh database and on one already migrated.

DO $$
DECLARE
  dupes text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = 'members_email_lower_key'
  ) THEN
    -- Refuse rather than dedupe. Which of two members is the real one, and what
    -- happened to the other, is the club's decision, not the migration's. Raise
    -- with the conflicting rows so the operator can resolve them by hand.
    SELECT string_agg(d.email || ' (x' || d.n || ')', ', ') INTO dupes
    FROM (
      SELECT lower(m.email) AS email, count(*) AS n
      FROM public.members m
      GROUP BY lower(m.email)
      HAVING count(*) > 1
      ORDER BY lower(m.email)
    ) d;

    IF dupes IS NOT NULL THEN
      RAISE EXCEPTION USING
        MESSAGE = 'Cannot add a unique index on members.email: duplicate addresses already exist.',
        DETAIL = dupes,
        HINT = 'Merge or delete the duplicate members, then run this migration again.';
    END IF;

    CREATE UNIQUE INDEX members_email_lower_key ON public.members (lower(email));
  END IF;
END $$;
