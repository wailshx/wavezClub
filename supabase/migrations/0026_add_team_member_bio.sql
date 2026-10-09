-- Adds a public bio to team members so long descriptions can stop living in
-- role_title, which caused the public Mentors & Community rows to stretch.
--
-- The column is nullable on purpose: a member can have a title and no bio.
--
-- This migration deliberately does NOT move existing role_title text into bio.
-- Deciding what belongs in a title vs a bio is a human call, so it only *lists*
-- the rows whose role_title exceeds the 80-character title rule for the admins
-- to reword by hand (the admin form blocks saving until the title fits).

ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS bio text;

-- Report anything that will not fit the 80-char title rule after this applies.
SELECT name, role_title, char_length(role_title) AS role_title_length
FROM public.team_members
WHERE role_title IS NOT NULL AND char_length(role_title) > 80
ORDER BY role_title_length DESC;