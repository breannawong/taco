-- Link Auth users to the household after creating them in the dashboard.
--
-- 1. Authentication → Users → create Dustin and Brea (email + password).
-- 2. Copy each user’s UUID.
-- 3. Replace the placeholder UUIDs below and run in the SQL Editor.
--
-- Profile id can match the auth user for simplicity; user_id is what the app
-- uses to find “who signed in.” Leave user_id null for people with no login.

insert into public.households (id, name)
values ('00000000-0000-0000-0000-000000000001', 'Dustin & Brea')
on conflict (id) do nothing;

insert into public.profiles (id, user_id, household_id, person_key, display_name, initial, color)
values
  (
    'DUSTIN_AUTH_USER_UUID',
    'DUSTIN_AUTH_USER_UUID',
    '00000000-0000-0000-0000-000000000001',
    'dustin',
    'Dustin',
    'D',
    '#17767D'
  ),
  (
    'BREA_AUTH_USER_UUID',
    'BREA_AUTH_USER_UUID',
    '00000000-0000-0000-0000-000000000001',
    'brea',
    'Brea',
    'B',
    '#A8406F'
  )
on conflict (id) do update set
  user_id = excluded.user_id,
  household_id = excluded.household_id,
  person_key = excluded.person_key,
  display_name = excluded.display_name,
  initial = excluded.initial,
  color = excluded.color;
