-- 0019: remap stored department / speciality values onto the faculty's lists.
--
-- DEPARTMENTS and SPECIALITIES in src/lib/club.ts were replaced with the
-- faculty's actual lists. Those are plain text columns with no CHECK
-- constraint, so existing rows kept the old strings — and a <select> whose
-- value is not among its options silently submits the first option instead.
-- Editing such a member would have quietly rewritten their department.
--
-- This maps the old values onto the new ones. Idempotent: rows already holding
-- a new value match nothing and are left alone.

UPDATE public.members SET department = 'Electrotechnics'
  WHERE department = 'Electrical Engineering';
UPDATE public.members SET department = 'Systems, Autonomous and AI'
  WHERE department = 'Electronic Systems';
UPDATE public.members SET department = 'Automatic Control'
  WHERE department = 'Automatic & Industrial Control';

UPDATE public.members SET speciality = 'Electrotechnics'
  WHERE speciality = 'Power Electronics';
UPDATE public.members SET speciality = 'Systems'
  WHERE speciality = 'Embedded Systems';
UPDATE public.members SET speciality = 'Telecommunications'
  WHERE speciality = 'Telecom & Signals';
UPDATE public.members SET speciality = 'Automatic Control'
  WHERE speciality = 'Control & Automation';

UPDATE public.registrations SET department = 'Electrotechnics'
  WHERE department = 'Electrical Engineering';
UPDATE public.registrations SET department = 'Systems, Autonomous and AI'
  WHERE department = 'Electronic Systems';
UPDATE public.registrations SET department = 'Automatic Control'
  WHERE department = 'Automatic & Industrial Control';

-- Anything still outside the lists is reported rather than guessed: an accepted
-- submission is a record of what the student actually wrote, and the officer
-- who reads it should reconcile it.
SELECT 'department outside the list' AS issue, department AS value, count(*) AS rows
  FROM (
    SELECT department FROM public.members
    UNION ALL
    SELECT department FROM public.registrations
  ) d
  WHERE department NOT IN (
    'Systems, Autonomous and AI',
    'Telecommunications',
    'Electrotechnics',
    'Automatic Control'
  )
  GROUP BY department;

SELECT 'speciality outside the list' AS issue, speciality AS value, count(*) AS rows
  FROM public.members
  WHERE speciality IS NOT NULL
    AND speciality NOT IN (
      'Systems',
      'Autonomous Systems',
      'Artificial Intelligence',
      'Telecommunications',
      'Electrotechnics',
      'Automatic Control'
    )
  GROUP BY speciality;
