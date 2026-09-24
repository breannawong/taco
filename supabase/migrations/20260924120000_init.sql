-- Taco Stage 3 — initial schema
-- Two-person household; flat relational model matching src/store/types.ts

-- ---------------------------------------------------------------------------
-- Household + members
-- ---------------------------------------------------------------------------

create table public.households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Our household',
  created_at timestamptz not null default now()
);

-- One row per signed-in user. person_key is who they pack as (dustin / brea).
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  household_id uuid not null references public.households (id) on delete cascade,
  person_key text not null,
  display_name text not null,
  initial text not null,
  color text not null,
  created_at timestamptz not null default now(),
  unique (household_id, person_key)
);

create index profiles_household_id_idx on public.profiles (household_id);

-- ---------------------------------------------------------------------------
-- Lists / sections / items / checks
-- ---------------------------------------------------------------------------

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  name text not null,
  kind text not null check (kind in ('template', 'trip')),
  template_id uuid references public.lists (id) on delete set null,
  created_at timestamptz not null default now()
);

create index lists_household_id_idx on public.lists (household_id);

create table public.sections (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  name text not null,
  position integer not null default 1000,
  source_section_id uuid references public.sections (id) on delete set null
);

create index sections_list_id_idx on public.sections (list_id);

create table public.items (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  section_id uuid not null references public.sections (id) on delete cascade,
  text text not null,
  who text not null,
  position integer not null default 1000,
  trip_only boolean not null default false
);

create index items_list_id_idx on public.items (list_id);
create index items_section_id_idx on public.items (section_id);

create table public.checks (
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  item_id uuid not null references public.items (id) on delete cascade,
  person_id text not null,
  checked_at timestamptz not null default now(),
  primary key (item_id, person_id)
);

create index checks_list_id_idx on public.checks (list_id);

-- ---------------------------------------------------------------------------
-- Helpers for RLS
-- ---------------------------------------------------------------------------

create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from public.profiles where id = auth.uid()
$$;

-- ---------------------------------------------------------------------------
-- Row level security: members only see/edit their household
-- ---------------------------------------------------------------------------

alter table public.households enable row level security;
alter table public.profiles enable row level security;
alter table public.lists enable row level security;
alter table public.sections enable row level security;
alter table public.items enable row level security;
alter table public.checks enable row level security;

create policy "Members can read own household"
  on public.households for select
  using (id = public.current_household_id());

create policy "Members can read household profiles"
  on public.profiles for select
  using (household_id = public.current_household_id());

create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid());

create policy "Members can read lists"
  on public.lists for select
  using (household_id = public.current_household_id());

create policy "Members can insert lists"
  on public.lists for insert
  with check (household_id = public.current_household_id());

create policy "Members can update lists"
  on public.lists for update
  using (household_id = public.current_household_id());

create policy "Members can delete lists"
  on public.lists for delete
  using (household_id = public.current_household_id());

create policy "Members can read sections"
  on public.sections for select
  using (household_id = public.current_household_id());

create policy "Members can insert sections"
  on public.sections for insert
  with check (household_id = public.current_household_id());

create policy "Members can update sections"
  on public.sections for update
  using (household_id = public.current_household_id());

create policy "Members can delete sections"
  on public.sections for delete
  using (household_id = public.current_household_id());

create policy "Members can read items"
  on public.items for select
  using (household_id = public.current_household_id());

create policy "Members can insert items"
  on public.items for insert
  with check (household_id = public.current_household_id());

create policy "Members can update items"
  on public.items for update
  using (household_id = public.current_household_id());

create policy "Members can delete items"
  on public.items for delete
  using (household_id = public.current_household_id());

create policy "Members can read checks"
  on public.checks for select
  using (household_id = public.current_household_id());

create policy "Members can insert checks"
  on public.checks for insert
  with check (household_id = public.current_household_id());

create policy "Members can update checks"
  on public.checks for update
  using (household_id = public.current_household_id());

create policy "Members can delete checks"
  on public.checks for delete
  using (household_id = public.current_household_id());

-- Realtime: enable for checks (and optionally lists) in the Supabase dashboard
-- Database → Replication → supabase_realtime publication, or:
-- alter publication supabase_realtime add table public.checks;
