-- E-Mail-Integration (n8n SMTP) pro Restaurant.

alter table public.restaurant_integrations
  add column if not exists config jsonb not null default '{}'::jsonb;

comment on column public.restaurant_integrations.config is
  'E-Mail: { "from_email", "from_name" }. WhatsApp: leer.';

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_key_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_key_check
  check (integration_key in ('whatsapp', 'email'));

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_status_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_status_check
  check (
    (
      integration_key = 'whatsapp'
      and status in (
        'disconnected',
        'starting',
        'scan_qr',
        'working',
        'failed',
        'stopped'
      )
    )
    or (
      integration_key = 'email'
      and status in ('default', 'custom')
    )
  );

create table if not exists public.reservation_email_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  message_kind text not null,
  send_at timestamptz not null,
  sent_at timestamptz,
  last_error text,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reservation_email_outbox_kind_check
    check (
      message_kind in (
        'received',
        'confirmed',
        'reminder',
        'thanks',
        'cancelled',
        'declined',
        'no_show'
      )
    ),
  constraint reservation_email_outbox_reservation_kind_uniq
    unique (reservation_id, message_kind)
);

create index if not exists reservation_email_outbox_due_idx
  on public.reservation_email_outbox (send_at)
  where sent_at is null and cancelled_at is null;

alter table public.reservation_email_outbox enable row level security;

create policy reservation_email_outbox_select_staff
  on public.reservation_email_outbox for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));
