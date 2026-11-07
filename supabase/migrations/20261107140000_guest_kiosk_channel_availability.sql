-- GW-80: Guest kiosk devices + Mollie terminal, per-channel menu availability,
-- sold-out grey/hide policy, optional guest live stock check (OFF by default).

-- ---------------------------------------------------------------------------
-- Online ordering settings extensions
-- ---------------------------------------------------------------------------

alter table public.restaurant_online_ordering_settings
  add column if not exists sold_out_guest_display text not null default 'hide',
  add column if not exists guest_live_stock_check_enabled boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'restaurant_online_ordering_settings_sold_out_display_chk'
  ) then
    alter table public.restaurant_online_ordering_settings
      add constraint restaurant_online_ordering_settings_sold_out_display_chk
      check (sold_out_guest_display in ('hide', 'grey'));
  end if;
end $$;

comment on column public.restaurant_online_ordering_settings.sold_out_guest_display is
  'Guest UX for sold-out items: hide (default) or grey (visible, not orderable).';

comment on column public.restaurant_online_ordering_settings.guest_live_stock_check_enabled is
  'Opt-in: guest menu/checkout checks inventory current_stock via recipes. Default OFF. Separate from POS inventory_booking_enabled.';

-- ---------------------------------------------------------------------------
-- Menu channel availability + sold-out (86)
-- ---------------------------------------------------------------------------

alter table public.menu_items
  add column if not exists available_online boolean not null default true,
  add column if not exists available_kiosk boolean not null default true,
  add column if not exists sold_out boolean not null default false;

alter table public.menu_categories
  add column if not exists available_online boolean not null default true,
  add column if not exists available_kiosk boolean not null default true;

comment on column public.menu_items.available_online is
  'Visible/orderable on /order guest channel when true.';
comment on column public.menu_items.available_kiosk is
  'Visible/orderable on /kiosk and table channels when true.';
comment on column public.menu_items.sold_out is
  'Manual 86 / ausverkauft — distinct from is_active archive.';
comment on column public.menu_categories.available_online is
  'Category offered on online guest channel.';
comment on column public.menu_categories.available_kiosk is
  'Category offered on kiosk/table guest channels.';

create index if not exists menu_items_sold_out_idx
  on public.menu_items (restaurant_id, sold_out)
  where sold_out = true;

-- ---------------------------------------------------------------------------
-- Guest kiosk devices (mirror Display/POS pairing; Mollie terminal per unit)
-- ---------------------------------------------------------------------------

create table if not exists public.restaurant_guest_kiosk_devices (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  mollie_terminal_id text,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_guest_kiosk_devices_name_len
    check (char_length(name) between 1 and 80),
  constraint restaurant_guest_kiosk_devices_terminal_fmt
    check (
      mollie_terminal_id is null
      or mollie_terminal_id ~ '^term_'
    )
);

create index if not exists restaurant_guest_kiosk_devices_restaurant_idx
  on public.restaurant_guest_kiosk_devices (restaurant_id, is_active);

drop trigger if exists restaurant_guest_kiosk_devices_set_updated_at
  on public.restaurant_guest_kiosk_devices;
create trigger restaurant_guest_kiosk_devices_set_updated_at
  before update on public.restaurant_guest_kiosk_devices
  for each row execute function public.set_updated_at();

comment on table public.restaurant_guest_kiosk_devices is
  'Fixed guest counter/table kiosk units: pairing + optional Mollie POS terminal.';

create table if not exists public.restaurant_guest_kiosk_pairing_codes (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null
    references public.restaurant_guest_kiosk_devices (id) on delete cascade,
  code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_guest_kiosk_pairing_codes_code_len
    check (char_length(code) = 8)
);

create unique index if not exists restaurant_guest_kiosk_pairing_codes_code_idx
  on public.restaurant_guest_kiosk_pairing_codes (code);

create index if not exists restaurant_guest_kiosk_pairing_codes_expires_idx
  on public.restaurant_guest_kiosk_pairing_codes (expires_at);

create table if not exists public.restaurant_guest_kiosk_installations (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null
    references public.restaurant_guest_kiosk_devices (id) on delete cascade,
  installation_id text not null,
  device_secret_hash text not null,
  user_agent text,
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_guest_kiosk_installations_installation_id_len
    check (char_length(installation_id) between 8 and 128),
  unique (device_id, installation_id)
);

create index if not exists restaurant_guest_kiosk_installations_device_hash_idx
  on public.restaurant_guest_kiosk_installations (device_id, device_secret_hash);

comment on table public.restaurant_guest_kiosk_installations is
  'Per physical tablet install for a guest kiosk device (hashed device token).';

-- ---------------------------------------------------------------------------
-- RLS (staff manage via pos.kasse.manage — same gate as Online & Kiosk POS)
-- ---------------------------------------------------------------------------

alter table public.restaurant_guest_kiosk_devices enable row level security;
alter table public.restaurant_guest_kiosk_pairing_codes enable row level security;
alter table public.restaurant_guest_kiosk_installations enable row level security;

drop policy if exists restaurant_guest_kiosk_devices_staff_select
  on public.restaurant_guest_kiosk_devices;
create policy restaurant_guest_kiosk_devices_staff_select
  on public.restaurant_guest_kiosk_devices for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

drop policy if exists restaurant_guest_kiosk_devices_staff_write
  on public.restaurant_guest_kiosk_devices;
create policy restaurant_guest_kiosk_devices_staff_write
  on public.restaurant_guest_kiosk_devices for all
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage')
  )
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'pos.kasse.manage')
  );

drop policy if exists restaurant_guest_kiosk_pairing_codes_staff_all
  on public.restaurant_guest_kiosk_pairing_codes;
create policy restaurant_guest_kiosk_pairing_codes_staff_all
  on public.restaurant_guest_kiosk_pairing_codes for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_guest_kiosk_devices d
      where d.id = device_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'pos.kasse.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_guest_kiosk_devices d
      where d.id = device_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'pos.kasse.manage')
    )
  );

drop policy if exists restaurant_guest_kiosk_installations_staff
  on public.restaurant_guest_kiosk_installations;
create policy restaurant_guest_kiosk_installations_staff
  on public.restaurant_guest_kiosk_installations for all
  to authenticated
  using (
    exists (
      select 1
      from public.restaurant_guest_kiosk_devices d
      where d.id = restaurant_guest_kiosk_installations.device_id
        and public.auth_is_restaurant_staff(d.restaurant_id)
    )
  )
  with check (
    exists (
      select 1
      from public.restaurant_guest_kiosk_devices d
      where d.id = restaurant_guest_kiosk_installations.device_id
        and public.auth_has_restaurant_permission(d.restaurant_id, 'pos.kasse.manage')
    )
  );
