-- 0028_member_checkins.sql
--
-- One attendance sheet for the current event: one row per member, either
-- present or absent. "Not marked" is the absence of a row, which is why the
-- page starts empty and why the reset button is a plain DELETE — it clears the
-- sheet and starts the next event from 0.
--
-- This is deliberately a single active sheet, not an events archive. The page
-- has one Save and one Reset, exactly as the officers asked for; keeping
-- several events would need an event picker and a history view.

create table if not exists public.member_checkins (
  member_id uuid primary key references public.members(id) on delete cascade,
  status text not null check (status in ('present', 'absent')),
  updated_at timestamptz not null default now(),
  updated_by uuid
);

comment on table public.member_checkins is
  'Current event attendance, one row per marked member. No row = not checked in yet.';

alter table public.member_checkins enable row level security;

drop policy if exists "admins read member checkins" on public.member_checkins;
create policy "admins read member checkins"
  on public.member_checkins for select to authenticated
  using (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins insert member checkins" on public.member_checkins;
create policy "admins insert member checkins"
  on public.member_checkins for insert to authenticated
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins update member checkins" on public.member_checkins;
create policy "admins update member checkins"
  on public.member_checkins for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

drop policy if exists "admins delete member checkins" on public.member_checkins;
create policy "admins delete member checkins"
  on public.member_checkins for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Supabase's default privileges can leave broad table grants behind (see
-- 0025); the page only ever reads and replaces this table.
revoke all on public.member_checkins from anon, authenticated;
grant select, insert, update, delete on public.member_checkins to authenticated;

-- Verify:
select policyname, cmd, roles::text, qual, with_check
from pg_policies
where schemaname = 'public' and tablename = 'member_checkins'
order by policyname;

select grantee, privilege_type
from information_schema.role_table_grants
where table_schema = 'public' and table_name = 'member_checkins'
order by grantee, privilege_type;
