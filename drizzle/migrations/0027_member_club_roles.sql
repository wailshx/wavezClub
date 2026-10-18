-- 0027: members get a club role, separate from the department they study in.
--
-- Departments say where a student studies (Systems/AI, Telecom, …). The club
-- role says what they do in the club (President, Media Member, …). Until now
-- the Members page could only show `admin_role` — a console permission — which
-- most members never have. This column is the club-side answer.
--
-- The eight leadership/team-lead roles are one-person jobs, so a partial unique
-- index enforces "at most one member holds each" in the database. The app also
-- pre-checks and names the holder, but the index is what makes the rule true
-- when two officers accept a submission at the same moment: the second insert
-- gets a 23505 it can turn into "X already holds that role".
--
-- Idempotent: safe on a fresh database and on one already migrated.

ALTER TABLE public.members ADD COLUMN IF NOT EXISTS club_role text;

CREATE UNIQUE INDEX IF NOT EXISTS members_exclusive_club_role_idx
  ON public.members (club_role)
  WHERE club_role IN (
    'president',
    'vice_president',
    'hr_leader',
    'vice_hr_leader',
    'media_leader',
    'vice_media_leader',
    'dev_leader',
    'vice_dev_leader'
  );

-- The multi-person roles (co_member, media_member, hr_member, wavez_member) are
-- deliberately outside the index: any number of members can hold them. They are
-- plain `text` with no CHECK constraint — same choice as department/speciality:
-- the vocabulary lives in `src/lib/club.ts`, so a value the UI does not know
-- renders as-is instead of being refused by the database.
--
-- Existing members are untouched: NULL means "no role decided yet", which is
-- the honest state for everyone accepted before this migration.

SELECT club_role, count(*) AS members
FROM public.members
GROUP BY club_role
ORDER BY club_role;
