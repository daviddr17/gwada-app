-- Optional demo data (runs after migrations; executed as DB superuser — RLS bypassed).
-- Remove or extend once you wire real auth and onboarding.

insert into public.restaurants (id, slug, name, description, is_published, timezone)
values (
  '00000000-0000-4000-8000-000000000001',
  'gwada-demo',
  'Gwada Demo',
  null,
  true,
  'America/Guadeloupe'
)
on conflict (slug) do nothing;
