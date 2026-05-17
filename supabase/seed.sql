-- Optional demo data (runs after migrations; executed as DB superuser — RLS bypassed).
-- Remove or extend once you wire real auth and onboarding.

insert into public.restaurants (slug, name, description, is_published, timezone)
values (
  'gwada-demo',
  'Gwada Demo',
  'Seed restaurant for local development.',
  true,
  'America/Guadeloupe'
)
on conflict (slug) do nothing;
