-- Tighten RLS on an already-migrated database.
-- Safe to run after 20260924120000_init.sql (does not recreate tables).
--
-- Changes:
-- 1. Profiles: block changing id / household_id / person_key (trigger + tighter update policy)
-- 2. Lists / sections / items / checks: add WITH CHECK on UPDATE so household_id can't move

-- ---------------------------------------------------------------------------
-- Profiles: lock identity columns
-- ---------------------------------------------------------------------------

create or replace function public.profiles_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.person_key is distinct from old.person_key then
    raise exception 'Cannot change id, household_id, or person_key on profiles';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;

create trigger profiles_protect_identity
  before update on public.profiles
  for each row
  execute function public.profiles_protect_identity();

drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Users can update own display fields" on public.profiles;

create policy "Users can update own display fields"
  on public.profiles for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and household_id = public.current_household_id()
  );

-- ---------------------------------------------------------------------------
-- Lists / sections / items / checks: WITH CHECK on UPDATE
-- ---------------------------------------------------------------------------

drop policy if exists "Members can update lists" on public.lists;
create policy "Members can update lists"
  on public.lists for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "Members can update sections" on public.sections;
create policy "Members can update sections"
  on public.sections for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "Members can update items" on public.items;
create policy "Members can update items"
  on public.items for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "Members can update checks" on public.checks;
create policy "Members can update checks"
  on public.checks for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
