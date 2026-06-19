-- Visual-Crossing-Timeline serverseitig cachen (Dashboard, Schichtplan).

create table if not exists public.weather_timeline_cache (
  cache_key text primary key,
  location text not null,
  from_date date,
  to_date date,
  payload jsonb not null,
  fetched_at timestamptz not null default timezone('utc', now())
);

create index if not exists weather_timeline_cache_fetched_at_idx
  on public.weather_timeline_cache (fetched_at desc);

comment on table public.weather_timeline_cache is
  'Visual Crossing Timeline — gemeinsamer Cache pro Ort/Zeitraum, Refresh per API/Cron.';

alter table public.weather_timeline_cache enable row level security;
