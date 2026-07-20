-- POS-Geräte: einmalige Restaurant-Kopplung + Mitarbeiter-Login per Display-PIN.

-- ---------------------------------------------------------------------------
-- Permission: Kasse bedienen (PIN-Login / Bestellen)
-- ---------------------------------------------------------------------------

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'pos.kasse.use'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager', 'host', 'server', 'other')
on conflict do nothing;

comment on column public.restaurant_position_permissions.permission_key is
  'Permission key; POS: pos.kasse.use (bedienen), pos.kasse.manage (öffnen/schließen), pos.kasse.export.';

-- ---------------------------------------------------------------------------
-- Geräteetabellen
-- ---------------------------------------------------------------------------

create table if not exists public.restaurant_pos_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  auto_lock_seconds integer not null default 300,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_pos_devices_name_len check (char_length(name) between 1 and 80),
  constraint restaurant_pos_devices_auto_lock check (auto_lock_seconds between 30 and 86400)
);

create index if not exists restaurant_pos_devices_restaurant_idx
  on public.restaurant_pos_devices (restaurant_id, is_active);

drop trigger if exists restaurant_pos_devices_set_updated_at on public.restaurant_pos_devices;
create trigger restaurant_pos_devices_set_updated_at
  before update on public.restaurant_pos_devices
  for each row execute function public.set_updated_at();

comment on table public.restaurant_pos_devices is
  'Gekoppelte POS-Geräte (iPad-Kasse / Handheld); Restaurant gebunden nach Pairing-Code.';

create table if not exists public.restaurant_pos_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.restaurant_pos_devices (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_pos_pairing_codes_code_len check (char_length(code) = 8)
);

create unique index if not exists restaurant_pos_pairing_codes_code_idx
  on public.restaurant_pos_pairing_codes (code);

create index if not exists restaurant_pos_pairing_codes_expires_idx
  on public.restaurant_pos_pairing_codes (expires_at);

create table if not exists public.restaurant_pos_installations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.restaurant_pos_devices (id) on delete cascade,
  installation_id text not null,
  device_secret_hash text not null,
  user_agent text,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_pos_installations_installation_id_len
    check (char_length(installation_id) between 8 and 128),
  unique (device_id, installation_id)
);

create index if not exists restaurant_pos_installations_device_hash_idx
  on public.restaurant_pos_installations (device_id, device_secret_hash);

comment on table public.restaurant_pos_installations is
  'Pro physischem Gerät eine Installation (client-seitige ID) mit eigenem Token.';

create table if not exists public.restaurant_pos_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.restaurant_pos_devices (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  session_token_hash text not null,
  started_at timestamptz not null default timezone('utc', now()),
  last_activity_at timestamptz not null default timezone('utc', now()),
  ended_at timestamptz
);

create unique index if not exists restaurant_pos_sessions_open_device_idx
  on public.restaurant_pos_sessions (device_id)
  where ended_at is null;

create index if not exists restaurant_pos_sessions_staff_idx
  on public.restaurant_pos_sessions (staff_id, started_at desc);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.restaurant_pos_devices enable row level security;
alter table public.restaurant_pos_pairing_codes enable row level security;
alter table public.restaurant_pos_installations enable row level security;
alter table public.restaurant_pos_sessions enable row level security;

drop policy if exists restaurant_pos_devices_staff_select on public.restaurant_pos_devices;
create policy restaurant_pos_devices_staff_select
  on public.restaurant_pos_devices for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists restaurant_pos_devices_staff_write on public.restaurant_pos_devices;
create policy restaurant_pos_devices_staff_write
  on public.restaurant_pos_devices for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage')
  );

drop policy if exists restaurant_pos_pairing_codes_staff_all on public.restaurant_pos_pairing_codes;
create policy restaurant_pos_pairing_codes_staff_all
  on public.restaurant_pos_pairing_codes for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_pos_devices d
      where d.id = device_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'pos.kasse.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_pos_devices d
      where d.id = device_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'pos.kasse.manage')
    )
  );

drop policy if exists restaurant_pos_installations_staff on public.restaurant_pos_installations;
create policy restaurant_pos_installations_staff
  on public.restaurant_pos_installations for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_pos_devices d
      where d.id = restaurant_pos_installations.device_id
        and public.auth_is_restaurant_staff(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_pos_devices d
      where d.id = restaurant_pos_installations.device_id
        and public.auth_is_restaurant_staff(d.restaurant_id)
    )
  );

drop policy if exists restaurant_pos_sessions_staff_select on public.restaurant_pos_sessions;
create policy restaurant_pos_sessions_staff_select
  on public.restaurant_pos_sessions for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));
