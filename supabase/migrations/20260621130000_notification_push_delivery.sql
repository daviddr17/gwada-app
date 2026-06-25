-- Push-Benachrichtigungen (Outbox): Events → Fan-out → Zustellung per Cron-Worker.
-- Skalierung: mehrere Worker mit SELECT … FOR UPDATE SKIP LOCKED auf notification_deliveries
-- (status = pending, scheduled_at <= now()); Events analog mit processed_at IS NULL.

create table public.notification_events (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid references public.restaurants (id) on delete cascade,
  module text not null,
  reference_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  processed_at timestamptz,
  constraint notification_events_module_check
    check (module in ('messages', 'reviews', 'reservations', 'changelog'))
);

comment on table public.notification_events is
  'Auslöser für externe Push-Zustellung; Verarbeitung erzeugt notification_deliveries (kein Versand im Request-Pfad).';

comment on column public.notification_events.restaurant_id is
  'NULL bei plattformweiten Events (z. B. Changelog für customers).';

create unique index notification_events_dedup_idx
  on public.notification_events (
    coalesce(restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid),
    module,
    reference_id
  );

create index notification_events_unprocessed_idx
  on public.notification_events (created_at)
  where processed_at is null;

create table public.notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.notification_events (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  context_restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  channel text not null,
  status text not null default 'pending',
  attempts integer not null default 0,
  last_error text,
  idempotency_key text not null,
  scheduled_at timestamptz not null default timezone('utc', now()),
  sent_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  constraint notification_deliveries_channel_check
    check (channel in ('whatsapp', 'email')),
  constraint notification_deliveries_status_check
    check (status in ('pending', 'sent', 'failed')),
  constraint notification_deliveries_idempotency_key_uniq
    unique (idempotency_key)
);

comment on table public.notification_deliveries is
  'Pro Empfänger/Kanal eine Zeile; Worker verarbeitet pending mit Rate-Limit und Backoff.';

comment on column public.notification_deliveries.context_restaurant_id is
  'Restaurant-Kontext für WAHA/SMTP (bei plattformweiten Events je Mitarbeiter-Restaurant).';

create index notification_deliveries_pending_scheduled_idx
  on public.notification_deliveries (scheduled_at)
  where status = 'pending';

create index if not exists notification_deliveries_created_at_desc_idx
  on public.notification_deliveries (created_at desc);

create index if not exists notification_events_created_at_desc_idx
  on public.notification_events (created_at desc);

alter table public.notification_events enable row level security;
alter table public.notification_deliveries enable row level security;

create policy notification_events_select_staff
  on public.notification_events for select
  to authenticated
  using (
    restaurant_id is not null
    and public.auth_is_restaurant_staff(restaurant_id)
  );

create policy notification_deliveries_select_own
  on public.notification_deliveries for select
  to authenticated
  using (profile_id = (select auth.uid()));

-- Event-Emission (leichtgewichtig, nur INSERT)

create or replace function public.trg_emit_notification_event_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_name text;
  preview text;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  select coalesce(
    nullif(trim(concat_ws(' ', c.given_name, c.family_name)), ''),
    'Kontakt'
  )
  into contact_name
  from public.contacts c
  where c.id = new.contact_id;

  preview := left(trim(coalesce(new.body, '')), 120);

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'messages',
    new.id::text,
    jsonb_build_object(
      'contactId', new.contact_id,
      'contactName', contact_name,
      'preview', preview,
      'platform', new.platform
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'messages'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create trigger contact_messages_notification_event
  after insert on public.contact_messages
  for each row
  execute function public.trg_emit_notification_event_messages();

create or replace function public.trg_emit_notification_event_gwada_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reviews',
    new.id::text,
    jsonb_build_object(
      'rating', new.rating,
      'authorName', coalesce(nullif(trim(new.guest_display_name), ''), 'Gast'),
      'commentPreview', left(trim(coalesce(new.comment, '')), 120)
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reviews'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create trigger gwada_reviews_notification_event
  after insert on public.gwada_reviews
  for each row
  execute function public.trg_emit_notification_event_gwada_review();

create or replace function public.trg_emit_notification_event_reservation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  status_code text;
begin
  select rs.code into status_code
  from public.reservation_statuses rs
  where rs.id = new.status_id;

  if status_code is distinct from 'pending' then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reservations',
    new.id::text,
    jsonb_build_object(
      'guestLabel', trim(concat_ws(' ', new.guest_first_name, new.guest_last_name)),
      'partySize', new.party_size,
      'startsAt', new.starts_at,
      'reservationNumber', new.reservation_number
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reservations'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create trigger reservations_notification_event
  after insert on public.reservations
  for each row
  execute function public.trg_emit_notification_event_reservation();

create or replace function public.trg_emit_notification_event_changelog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience is distinct from 'customers' then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    null,
    'changelog',
    new.id::text,
    jsonb_build_object(
      'title', new.title,
      'version', new.version,
      'publishedAt', new.published_at
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'changelog'
      and e.reference_id = new.id::text
      and e.restaurant_id is null
  );

  return new;
end;
$$;

create trigger platform_changelog_entries_notification_event
  after insert on public.platform_changelog_entries
  for each row
  execute function public.trg_emit_notification_event_changelog();
