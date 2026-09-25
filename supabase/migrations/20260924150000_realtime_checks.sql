-- Enable live pack/unpack for checks (Stage 3 step 5).
-- Run in Supabase SQL Editor if this project was created before this migration.

-- DELETE events need full row data so household_id filters work.
alter table public.checks replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'checks'
  ) then
    alter publication supabase_realtime add table public.checks;
  end if;
end $$;
