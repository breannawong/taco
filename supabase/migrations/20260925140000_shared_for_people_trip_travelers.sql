-- Future-proof packing model (app still speaks who / person_key for now).
--
-- 1) Profiles can exist without a login (kids / guests we pack for).
-- 2) Item "who" becomes shared + for_people (empty for_people = everyone).
-- 3) trip_travelers records who is on each trip.

-- ---------------------------------------------------------------------------
-- Profiles: detach PK from auth.users; link via nullable user_id
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists user_id uuid unique references auth.users (id) on delete set null;

-- Existing rows: profile id was the auth user id
update public.profiles
set user_id = id
where user_id is null;

-- Drop FK that forced profiles.id = auth.users.id (constraint name from init)
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

comment on column public.profiles.user_id is
  'Auth user linked to this profile; null = person we pack for with no login.';

-- Look up household by login, not by profile primary key
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where user_id = auth.uid()
$$;

-- Keep locking identity fields; also lock user_id (linking is a later admin step)
create or replace function public.profiles_protect_identity()
returns trigger
language plpgsql
as $$
begin
  if new.id is distinct from old.id
     or new.household_id is distinct from old.household_id
     or new.person_key is distinct from old.person_key
     or new.user_id is distinct from old.user_id then
    raise exception 'Cannot change id, household_id, person_key, or user_id on profiles';
  end if;
  return new;
end;
$$;

drop policy if exists "Users can update own display fields" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can update own display fields"
  on public.profiles for update
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and household_id = public.current_household_id()
  );

-- ---------------------------------------------------------------------------
-- Items: shared boolean + for_people uuid[] (empty = everyone on the trip)
-- ---------------------------------------------------------------------------

alter table public.items
  add column if not exists shared boolean not null default false;

alter table public.items
  add column if not exists for_people uuid[] not null default '{}';

comment on column public.items.shared is
  'True = one check for the household. False = each listed person packs their own (or everyone if for_people is empty).';

comment on column public.items.for_people is
  'Profile ids who owe this item. Empty array means everyone (on the trip / household).';

-- Map legacy who text → new columns
update public.items
set shared = true,
    for_people = '{}'
where who = 'shared';

update public.items
set shared = false,
    for_people = '{}'
where who = 'each';

update public.items i
set shared = false,
    for_people = array[p.id]
from public.profiles p
where i.household_id = p.household_id
  and i.who = p.person_key
  and i.who not in ('shared', 'each');

alter table public.items
  drop column if exists who;

-- ---------------------------------------------------------------------------
-- Trip travelers: who is going on this trip
-- ---------------------------------------------------------------------------

create table if not exists public.trip_travelers (
  household_id uuid not null references public.households (id) on delete cascade,
  trip_id uuid not null references public.lists (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  primary key (trip_id, profile_id)
);

create index if not exists trip_travelers_household_id_idx
  on public.trip_travelers (household_id);

create index if not exists trip_travelers_profile_id_idx
  on public.trip_travelers (profile_id);

comment on table public.trip_travelers is
  'People on a trip. Empty for_people on items means everyone in this set.';

alter table public.trip_travelers enable row level security;

drop policy if exists "Members can read trip travelers" on public.trip_travelers;
create policy "Members can read trip travelers"
  on public.trip_travelers for select
  using (household_id = public.current_household_id());

drop policy if exists "Members can insert trip travelers" on public.trip_travelers;
create policy "Members can insert trip travelers"
  on public.trip_travelers for insert
  with check (household_id = public.current_household_id());

drop policy if exists "Members can update trip travelers" on public.trip_travelers;
create policy "Members can update trip travelers"
  on public.trip_travelers for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "Members can delete trip travelers" on public.trip_travelers;
create policy "Members can delete trip travelers"
  on public.trip_travelers for delete
  using (household_id = public.current_household_id());

-- Existing trips: both household members are travelers
insert into public.trip_travelers (household_id, trip_id, profile_id)
select l.household_id, l.id, p.id
from public.lists l
join public.profiles p on p.household_id = l.household_id
where l.kind = 'trip'
on conflict do nothing;
