-- Who actually tapped the check (may differ from person_id on Each / help-pack).
-- person_id = whose pack slot; checked_by = who tapped.

alter table public.checks
  add column if not exists checked_by text;

comment on column public.checks.checked_by is
  'Person who tapped the control; person_id is whose pack obligation.';
