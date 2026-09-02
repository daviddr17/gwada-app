-- Atomarer Claim für Reservierungs-Outbox (WhatsApp + E-Mail).
-- Verhindert Doppelversand bei parallelen Cron-Läufen / curl-Retries.
-- Pattern wie claim_notification_deliveries (FOR UPDATE SKIP LOCKED).

alter table public.reservation_whatsapp_outbox
  add column if not exists claimed_at timestamptz;

comment on column public.reservation_whatsapp_outbox.claimed_at is
  'Cron-Claim vor WAHA-Send; verhindert Doppelversand. Null = frei.';

alter table public.reservation_email_outbox
  add column if not exists claimed_at timestamptz;

comment on column public.reservation_email_outbox.claimed_at is
  'Cron-Claim vor E-Mail-Send; verhindert Doppelversand. Null = frei.';

-- Stale Claims freigeben (Worker-Crash nach Claim, vor Mark sent_at).
create or replace function public.release_stale_reservation_whatsapp_outbox(
  p_stale_minutes integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.reservation_whatsapp_outbox
  set
    claimed_at = null,
    last_error = coalesce(last_error, 'claim_timeout')
  where sent_at is null
    and cancelled_at is null
    and claimed_at is not null
    and claimed_at < timezone('utc', now())
      - make_interval(mins => greatest(1, p_stale_minutes));

  get diagnostics released = row_count;
  return released;
end;
$$;

create or replace function public.release_stale_reservation_email_outbox(
  p_stale_minutes integer default 10
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.reservation_email_outbox
  set
    claimed_at = null,
    last_error = coalesce(last_error, 'claim_timeout')
  where sent_at is null
    and cancelled_at is null
    and claimed_at is not null
    and claimed_at < timezone('utc', now())
      - make_interval(mins => greatest(1, p_stale_minutes));

  get diagnostics released = row_count;
  return released;
end;
$$;

create or replace function public.claim_reservation_whatsapp_outbox(
  p_limit integer default 20
)
returns table (
  id uuid,
  reservation_id uuid,
  message_kind text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_stale_reservation_whatsapp_outbox(10);

  return query
  update public.reservation_whatsapp_outbox o
  set claimed_at = timezone('utc', now())
  from (
    select w.id
    from public.reservation_whatsapp_outbox w
    where w.sent_at is null
      and w.cancelled_at is null
      and w.claimed_at is null
      and w.send_at <= timezone('utc', now())
      and w.message_kind in ('reminder', 'thanks')
    order by w.send_at asc
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ) picked
  where o.id = picked.id
  returning o.id, o.reservation_id, o.message_kind;
end;
$$;

comment on function public.claim_reservation_whatsapp_outbox(integer) is
  'Cron: holt fällige WhatsApp-Outbox-Zeilen atomar (SKIP LOCKED) vor dem Send.';

create or replace function public.claim_reservation_email_outbox(
  p_limit integer default 50
)
returns table (
  id uuid,
  reservation_id uuid,
  message_kind text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.release_stale_reservation_email_outbox(10);

  return query
  update public.reservation_email_outbox o
  set claimed_at = timezone('utc', now())
  from (
    select e.id
    from public.reservation_email_outbox e
    where e.sent_at is null
      and e.cancelled_at is null
      and e.claimed_at is null
      and e.send_at <= timezone('utc', now())
      and e.message_kind in ('reminder', 'thanks')
    order by e.send_at asc
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ) picked
  where o.id = picked.id
  returning o.id, o.reservation_id, o.message_kind;
end;
$$;

comment on function public.claim_reservation_email_outbox(integer) is
  'Cron: holt fällige E-Mail-Outbox-Zeilen atomar (SKIP LOCKED) vor dem Send.';

revoke all on function public.claim_reservation_whatsapp_outbox(integer) from public;
revoke all on function public.claim_reservation_email_outbox(integer) from public;
revoke all on function public.release_stale_reservation_whatsapp_outbox(integer) from public;
revoke all on function public.release_stale_reservation_email_outbox(integer) from public;

grant execute on function public.claim_reservation_whatsapp_outbox(integer) to service_role;
grant execute on function public.claim_reservation_email_outbox(integer) to service_role;
grant execute on function public.release_stale_reservation_whatsapp_outbox(integer) to service_role;
grant execute on function public.release_stale_reservation_email_outbox(integer) to service_role;
