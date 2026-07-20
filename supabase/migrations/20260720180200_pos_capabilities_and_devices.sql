-- Phase 1: POS Capabilities / Rollen + Geräte-Enrollment (Hub/Handheld).

-- ---------------------------------------------------------------------------
-- Capability catalog (global)
-- ---------------------------------------------------------------------------
create table if not exists public.pos_capabilities (
  key text primary key,
  label_de text not null,
  description_de text,
  sort_order integer not null default 0
);

comment on table public.pos_capabilities is
  'Globale POS-Capabilities für die Kellner-App (Mehr-Tab, Schichtübergabe, …).';

insert into public.pos_capabilities (key, label_de, description_de, sort_order) values
  ('transfer', 'Schichtübergabe', 'Offene Sessions an Kolleg:in übergeben (4-Augen).', 10),
  ('day_close', 'Tagesabschluss', 'Z-Bericht / Tagesabschluss auslösen.', 20),
  ('void', 'Storno', 'Gegenbuchungen mit Begründung.', 30),
  ('cash_count', 'Kassensturz', 'Bar-Zählung zur Schicht/zum Tagesende.', 40),
  ('reports', 'Berichte', 'Umsatz- und Artikelauswertungen.', 50),
  ('devices', 'Geräte', 'Hub/Drucker/Geräte verwalten.', 60)
on conflict (key) do update
  set label_de = excluded.label_de,
      description_de = excluded.description_de,
      sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- Per-restaurant roles (bundles of capabilities)
-- ---------------------------------------------------------------------------
create table if not exists public.pos_roles (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  slug text not null,
  is_system boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (restaurant_id, slug)
);

create index if not exists pos_roles_restaurant_idx
  on public.pos_roles (restaurant_id, sort_order, name);

drop trigger if exists pos_roles_set_updated_at on public.pos_roles;
create trigger pos_roles_set_updated_at
  before update on public.pos_roles
  for each row execute function public.set_updated_at();

create table if not exists public.pos_role_capabilities (
  role_id uuid not null references public.pos_roles (id) on delete cascade,
  capability_key text not null references public.pos_capabilities (key) on delete cascade,
  primary key (role_id, capability_key)
);

alter table public.restaurant_staff
  add column if not exists pos_role_id uuid references public.pos_roles (id) on delete set null;

create index if not exists restaurant_staff_pos_role_idx
  on public.restaurant_staff (pos_role_id)
  where pos_role_id is not null;

-- Seed system roles for each restaurant (idempotent)
create or replace function public.ensure_pos_system_roles(p_restaurant_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r_service uuid;
  r_shift uuid;
  r_manager uuid;
begin
  insert into public.pos_roles (restaurant_id, name, slug, is_system, sort_order)
  values (p_restaurant_id, 'Service', 'service', true, 10)
  on conflict (restaurant_id, slug) do update set name = excluded.name;

  insert into public.pos_roles (restaurant_id, name, slug, is_system, sort_order)
  values (p_restaurant_id, 'Schichtleitung', 'shift_lead', true, 20)
  on conflict (restaurant_id, slug) do update set name = excluded.name;

  insert into public.pos_roles (restaurant_id, name, slug, is_system, sort_order)
  values (p_restaurant_id, 'Manager', 'manager', true, 30)
  on conflict (restaurant_id, slug) do update set name = excluded.name;

  select id into r_service from public.pos_roles
  where restaurant_id = p_restaurant_id and slug = 'service';
  select id into r_shift from public.pos_roles
  where restaurant_id = p_restaurant_id and slug = 'shift_lead';
  select id into r_manager from public.pos_roles
  where restaurant_id = p_restaurant_id and slug = 'manager';

  insert into public.pos_role_capabilities (role_id, capability_key)
  values (r_service, 'transfer')
  on conflict do nothing;

  insert into public.pos_role_capabilities (role_id, capability_key)
  values
    (r_shift, 'transfer'),
    (r_shift, 'day_close'),
    (r_shift, 'void'),
    (r_shift, 'cash_count')
  on conflict do nothing;

  insert into public.pos_role_capabilities (role_id, capability_key)
  select r_manager, c.key from public.pos_capabilities c
  on conflict do nothing;
end;
$$;

revoke all on function public.ensure_pos_system_roles(uuid) from public;
grant execute on function public.ensure_pos_system_roles(uuid) to authenticated, service_role;

alter table public.pos_roles enable row level security;
alter table public.pos_role_capabilities enable row level security;
alter table public.pos_capabilities enable row level security;

drop policy if exists pos_capabilities_read on public.pos_capabilities;
create policy pos_capabilities_read
  on public.pos_capabilities for select
  to authenticated
  using (true);

drop policy if exists pos_roles_access on public.pos_roles;
create policy pos_roles_access
  on public.pos_roles for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage'));

drop policy if exists pos_role_capabilities_access on public.pos_role_capabilities;
create policy pos_role_capabilities_access
  on public.pos_role_capabilities for all
  to authenticated
  using (
    exists (
      select 1 from public.pos_roles r
      where r.id = pos_role_capabilities.role_id
        and public.auth_has_restaurant_permission(r.restaurant_id, 'pos.kasse.manage')
    )
  )
  with check (
    exists (
      select 1 from public.pos_roles r
      where r.id = pos_role_capabilities.role_id
        and public.auth_has_restaurant_permission(r.restaurant_id, 'pos.kasse.manage')
    )
  );

-- ---------------------------------------------------------------------------
-- Devices / enrollment
-- ---------------------------------------------------------------------------
create table if not exists public.pos_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  kind text not null default 'handheld',
  enrollment_code_hash text,
  enrollment_code_hint text,
  enrollment_expires_at timestamptz,
  device_token_hash text,
  enrolled_at timestamptz,
  last_seen_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pos_devices_kind_chk check (kind in ('hub', 'handheld'))
);

create index if not exists pos_devices_restaurant_idx
  on public.pos_devices (restaurant_id, is_active, kind);

drop trigger if exists pos_devices_set_updated_at on public.pos_devices;
create trigger pos_devices_set_updated_at
  before update on public.pos_devices
  for each row execute function public.set_updated_at();

alter table public.pos_devices enable row level security;

drop policy if exists pos_devices_access on public.pos_devices;
create policy pos_devices_access
  on public.pos_devices for all
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage'));

comment on table public.pos_devices is
  'Enrollte Kellner-/Hub-Geräte; Klartext-Enrollment-Code nur einmal in der API-Response.';
