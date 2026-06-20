-- Buchführung: Benachrichtigungen für neue Angebote, Rechnungen und Belege

-- ---------------------------------------------------------------------------
-- notification_events: Modul-IDs erweitern
-- ---------------------------------------------------------------------------
alter table public.notification_events
  drop constraint if exists notification_events_module_check;

alter table public.notification_events
  add constraint notification_events_module_check
  check (
    module in (
      'messages',
      'reviews',
      'changelog',
      'reservations_pending',
      'reservations_change_request',
      'reservations_cancellation',
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock',
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher'
    )
  );

-- ---------------------------------------------------------------------------
-- Glocke: Dismissals pro Dokument + Modul
-- ---------------------------------------------------------------------------
create table if not exists public.restaurant_accounting_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_id uuid not null,
  module text not null check (
    module in (
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher'
    )
  ),
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, document_id, module)
);

create index if not exists restaurant_accounting_notification_dismissals_restaurant_idx
  on public.restaurant_accounting_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_accounting_notification_dismissals enable row level security;

create policy restaurant_accounting_notification_dismissals_rw_own_staff
  on public.restaurant_accounting_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

-- ---------------------------------------------------------------------------
-- Hilfsfunktion: Empfänger-Label aus recipient_snapshot
-- ---------------------------------------------------------------------------
create or replace function public.accounting_recipient_label_from_snapshot(p_snapshot jsonb)
returns text
language sql
immutable
as $$
  select coalesce(
    nullif(trim(p_snapshot->>'companyName'), ''),
    nullif(trim(p_snapshot->>'name'), ''),
    nullif(trim(p_snapshot->>'displayName'), ''),
    nullif(trim(p_snapshot->>'contactName'), ''),
    'Empfänger'
  );
$$;

-- ---------------------------------------------------------------------------
-- Push-Events: Angebote
-- ---------------------------------------------------------------------------
create or replace function public.trg_emit_notification_event_accounting_quotation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient text;
  v_amount text;
begin
  v_recipient := public.accounting_recipient_label_from_snapshot(new.recipient_snapshot);
  v_amount := case
    when (new.totals->>'gross') is not null then
      to_char((new.totals->>'gross')::numeric, 'FM999999990.00') || ' ' || coalesce(new.currency, 'EUR')
    else null
  end;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'accounting_quotation',
    new.id::text,
    jsonb_build_object(
      'documentId', new.id,
      'title', coalesce(nullif(trim(new.title), ''), 'Neues Angebot'),
      'voucherNumber', new.voucher_number,
      'recipientLabel', v_recipient,
      'amountLabel', v_amount,
      'createdByProfileId', new.created_by
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'accounting_quotation'
      and e.reference_id = new.id::text
      and e.restaurant_id = new.restaurant_id
  );

  return new;
end;
$$;

drop trigger if exists accounting_quotations_notification_event
  on public.accounting_quotations;

create trigger accounting_quotations_notification_event
  after insert on public.accounting_quotations
  for each row
  execute function public.trg_emit_notification_event_accounting_quotation();

-- ---------------------------------------------------------------------------
-- Push-Events: Rechnungen
-- ---------------------------------------------------------------------------
create or replace function public.trg_emit_notification_event_accounting_invoice()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipient text;
  v_amount text;
begin
  v_recipient := public.accounting_recipient_label_from_snapshot(new.recipient_snapshot);
  v_amount := case
    when (new.totals->>'gross') is not null then
      to_char((new.totals->>'gross')::numeric, 'FM999999990.00') || ' ' || coalesce(new.currency, 'EUR')
    else null
  end;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'accounting_invoice',
    new.id::text,
    jsonb_build_object(
      'documentId', new.id,
      'title', coalesce(nullif(trim(new.title), ''), 'Neue Rechnung'),
      'voucherNumber', new.voucher_number,
      'recipientLabel', v_recipient,
      'amountLabel', v_amount,
      'createdByProfileId', new.created_by
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'accounting_invoice'
      and e.reference_id = new.id::text
      and e.restaurant_id = new.restaurant_id
  );

  return new;
end;
$$;

drop trigger if exists accounting_invoices_notification_event
  on public.accounting_invoices;

create trigger accounting_invoices_notification_event
  after insert on public.accounting_invoices
  for each row
  execute function public.trg_emit_notification_event_accounting_invoice();

-- ---------------------------------------------------------------------------
-- Push-Events: Belege
-- ---------------------------------------------------------------------------
create or replace function public.trg_emit_notification_event_accounting_voucher()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_amount text;
begin
  v_amount := to_char(new.total_gross_amount, 'FM999999990.00')
    || ' ' || coalesce(new.currency, 'EUR');

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'accounting_voucher',
    new.id::text,
    jsonb_build_object(
      'documentId', new.id,
      'voucherNumber', new.voucher_number,
      'contactName', coalesce(nullif(trim(new.contact_name), ''), 'Beleg'),
      'amountLabel', v_amount,
      'createdByProfileId', new.created_by
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'accounting_voucher'
      and e.reference_id = new.id::text
      and e.restaurant_id = new.restaurant_id
  );

  return new;
end;
$$;

drop trigger if exists accounting_vouchers_notification_event
  on public.accounting_vouchers;

create trigger accounting_vouchers_notification_event
  after insert on public.accounting_vouchers
  for each row
  execute function public.trg_emit_notification_event_accounting_voucher();
