-- Pro Restaurant: WhatsApp/WAHA-Verbindungsstatus (Session-Name, Status).

create table if not exists public.restaurant_integrations (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  integration_key text not null,
  waha_session_name text not null,
  status text not null default 'disconnected',
  phone_number text,
  display_name text,
  connected_at timestamptz,
  last_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, integration_key),
  constraint restaurant_integrations_key_check
    check (integration_key in ('whatsapp')),
  constraint restaurant_integrations_status_check
    check (
      status in (
        'disconnected',
        'starting',
        'scan_qr',
        'working',
        'failed',
        'stopped'
      )
    )
);

create trigger restaurant_integrations_set_updated_at
  before update on public.restaurant_integrations
  for each row execute function public.set_updated_at();

create index if not exists restaurant_integrations_waha_session_idx
  on public.restaurant_integrations (waha_session_name);

comment on table public.restaurant_integrations is
  'Mandanten-Integrationen (z. B. WhatsApp via WAHA).';

alter table public.restaurant_integrations enable row level security;

create policy restaurant_integrations_select_staff
  on public.restaurant_integrations for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_integrations_write_managers
  on public.restaurant_integrations for all
  to authenticated
  using (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  )
  with check (
    public.auth_is_restaurant_staff(
      restaurant_id,
      array['owner', 'manager']::public.employee_role[]
    )
  );
