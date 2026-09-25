-- Archive finished trips (nullable timestamp).

alter table public.lists
  add column if not exists archived_at timestamptz;

comment on column public.lists.archived_at is
  'When set, trip is archived (Past trips on Home). Null = active.';
