-- OAuth-Seitenauswahl: Payload serverseitig (keine riesigen HttpOnly-Cookies mehr).

create table if not exists public.oauth_integration_pending (
  id uuid primary key default gen_random_uuid(),
  provider text not null check (provider in ('facebook', 'instagram', 'google_business')),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  payload jsonb not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists oauth_integration_pending_expires_idx
  on public.oauth_integration_pending (expires_at);

alter table public.oauth_integration_pending enable row level security;

-- Nur Service-Role (API-Routes); kein Client-Zugriff.
