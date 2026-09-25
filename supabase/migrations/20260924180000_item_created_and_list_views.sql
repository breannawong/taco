-- Item authorship + per-person last viewed (for "New" tags from others).

alter table public.items
  add column if not exists created_at timestamptz not null default now();

alter table public.items
  add column if not exists created_by text;

comment on column public.items.created_by is
  'person_key of who added the item (dustin / brea).';

create table if not exists public.list_views (
  household_id uuid not null references public.households (id) on delete cascade,
  list_id uuid not null references public.lists (id) on delete cascade,
  person_id text not null,
  last_viewed_at timestamptz not null default now(),
  primary key (list_id, person_id)
);

create index if not exists list_views_household_id_idx
  on public.list_views (household_id);

alter table public.list_views enable row level security;

drop policy if exists "Members can read list views" on public.list_views;
create policy "Members can read list views"
  on public.list_views for select
  using (household_id = public.current_household_id());

drop policy if exists "Members can insert list views" on public.list_views;
create policy "Members can insert list views"
  on public.list_views for insert
  with check (household_id = public.current_household_id());

drop policy if exists "Members can update list views" on public.list_views;
create policy "Members can update list views"
  on public.list_views for update
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

drop policy if exists "Members can delete list views" on public.list_views;
create policy "Members can delete list views"
  on public.list_views for delete
  using (household_id = public.current_household_id());
