-- WAHA-Server-Pool (Superadmin): mehrere Hosts, sticky Assignment pro Restaurant.

create table if not exists public.waha_servers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  base_url text not null,
  api_key text not null default '',
  enabled boolean not null default true,
  accept_new_sessions boolean not null default true,
  session_limit integer not null default 200
    check (session_limit > 0 and session_limit <= 10000),
  warn_remaining integer not null default 10
    check (warn_remaining >= 0 and warn_remaining <= 1000),
  sort_order integer not null default 100,
  notes text,
  last_health_ok_at timestamptz,
  last_health_error text,
  capacity_warning_active boolean not null default false,
  capacity_warning_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint waha_servers_base_url_unique unique (base_url),
  constraint waha_servers_name_nonempty check (char_length(trim(name)) > 0),
  constraint waha_servers_base_url_nonempty check (char_length(trim(base_url)) > 0)
);

create trigger waha_servers_set_updated_at
  before update on public.waha_servers
  for each row execute function public.set_updated_at();

comment on table public.waha_servers is
  'Plattform-WAHA-Hosts (Pool). Secrets nur Service-Role / Superadmin.';

alter table public.waha_servers enable row level security;

create policy waha_servers_superadmin_all
  on public.waha_servers
  for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

alter table public.restaurant_integrations
  add column if not exists waha_server_id uuid
    references public.waha_servers (id) on delete set null;

create index if not exists restaurant_integrations_waha_server_id_idx
  on public.restaurant_integrations (waha_server_id)
  where integration_key = 'whatsapp';

-- Seed: bestehenden Plattform-WhatsApp-WAHA-Eintrag als ersten Server übernehmen.
do $$
declare
  v_base text;
  v_key text;
  v_server_id uuid;
begin
  select
    nullif(trim(coalesce(config->>'waha_base_url', config->>'waha_baseUrl', config->>'base_url', '')), ''),
    nullif(trim(coalesce(config->>'waha_api_key', config->>'api_key', config->'extra'->>'waha_api_key', '')), '')
  into v_base, v_key
  from public.platform_integrations
  where key = 'whatsapp'
  limit 1;

  if v_base is null or v_key is null then
    return;
  end if;

  -- trailing slash entfernen
  v_base := regexp_replace(v_base, '/+$', '');

  insert into public.waha_servers (
    name,
    base_url,
    api_key,
    enabled,
    accept_new_sessions,
    session_limit,
    warn_remaining,
    sort_order,
    notes
  )
  values (
    'Primär',
    v_base,
    v_key,
    true,
    true,
    200,
    10,
    10,
    'Aus platform_integrations.whatsapp migriert'
  )
  on conflict (base_url) do update
    set
      api_key = excluded.api_key,
      updated_at = timezone('utc', now())
  returning id into v_server_id;

  if v_server_id is null then
    select id into v_server_id
    from public.waha_servers
    where base_url = v_base
    limit 1;
  end if;

  if v_server_id is not null then
    update public.restaurant_integrations
    set waha_server_id = v_server_id
    where integration_key = 'whatsapp'
      and waha_server_id is null;
  end if;
end $$;
