-- Reservierungs-WhatsApp: Einstellungen + Outbox für geplante Nachrichten.

alter table public.restaurant_reservation_settings
  add column if not exists whatsapp_received_enabled boolean not null default true,
  add column if not exists whatsapp_confirmed_enabled boolean not null default true,
  add column if not exists whatsapp_reminder_enabled boolean not null default true,
  add column if not exists whatsapp_reminder_hours_before numeric(6, 2) not null default 24
    check (whatsapp_reminder_hours_before >= 0 and whatsapp_reminder_hours_before <= 168),
  add column if not exists whatsapp_thanks_enabled boolean not null default true,
  add column if not exists whatsapp_thanks_hours_after numeric(6, 2) not null default 2
    check (whatsapp_thanks_hours_after >= 0 and whatsapp_thanks_hours_after <= 168);

comment on column public.restaurant_reservation_settings.whatsapp_received_enabled is
  'WhatsApp bei neuer Reservierung (Status Offen).';
comment on column public.restaurant_reservation_settings.whatsapp_confirmed_enabled is
  'WhatsApp wenn Status auf Bestätigt wechselt.';
comment on column public.restaurant_reservation_settings.whatsapp_reminder_enabled is
  'Erinnerung X Stunden vor starts_at.';
comment on column public.restaurant_reservation_settings.whatsapp_thanks_hours_after is
  'Danke/Bewertung X Stunden nach ends_at.';

create table if not exists public.reservation_whatsapp_outbox (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  message_kind text not null,
  send_at timestamptz not null,
  sent_at timestamptz,
  last_error text,
  cancelled_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint reservation_whatsapp_outbox_kind_check
    check (message_kind in ('received', 'confirmed', 'reminder', 'thanks')),
  constraint reservation_whatsapp_outbox_reservation_kind_uniq
    unique (reservation_id, message_kind)
);

create index if not exists reservation_whatsapp_outbox_due_idx
  on public.reservation_whatsapp_outbox (send_at)
  where sent_at is null and cancelled_at is null;

alter table public.reservation_whatsapp_outbox enable row level security;

create policy reservation_whatsapp_outbox_select_staff
  on public.reservation_whatsapp_outbox for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

-- Schreiben nur serverseitig (Service Role / security definer) — keine Client-Policy für insert/update
