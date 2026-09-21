-- Outbox: Altlasten (>36h nach send_at) auto-canceln, Claim liefert send_at,
-- frische fällige Zeilen zuerst (verhindert Timeout-Queue-Blockade).

create or replace function public.cancel_stale_reservation_whatsapp_outbox(
  p_stale_hours integer default 36
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled integer;
begin
  update public.reservation_whatsapp_outbox
  set
    cancelled_at = timezone('utc', now()),
    claimed_at = null,
    last_error = 'too_late'
  where sent_at is null
    and cancelled_at is null
    and message_kind in ('reminder', 'thanks')
    and send_at < timezone('utc', now())
      - make_interval(hours => greatest(1, p_stale_hours));

  get diagnostics cancelled = row_count;
  return cancelled;
end;
$$;

create or replace function public.cancel_stale_reservation_email_outbox(
  p_stale_hours integer default 36
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  cancelled integer;
begin
  update public.reservation_email_outbox
  set
    cancelled_at = timezone('utc', now()),
    claimed_at = null,
    last_error = 'too_late'
  where sent_at is null
    and cancelled_at is null
    and message_kind in ('reminder', 'thanks')
    and send_at < timezone('utc', now())
      - make_interval(hours => greatest(1, p_stale_hours));

  get diagnostics cancelled = row_count;
  return cancelled;
end;
$$;

-- Return-Typ ändert sich (send_at hinzu) → DROP nötig vor CREATE.
drop function if exists public.claim_reservation_whatsapp_outbox(integer);
drop function if exists public.claim_reservation_email_outbox(integer);

create function public.claim_reservation_whatsapp_outbox(
  p_limit integer default 20
)
returns table (
  id uuid,
  reservation_id uuid,
  message_kind text,
  send_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cancel_stale_reservation_whatsapp_outbox(36);
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
    -- Frische zuerst: Alt-Timeouts sollen neue Erinnerungen nicht blockieren.
    order by w.send_at desc
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ) picked
  where o.id = picked.id
  returning o.id, o.reservation_id, o.message_kind, o.send_at;
end;
$$;

create function public.claim_reservation_email_outbox(
  p_limit integer default 50
)
returns table (
  id uuid,
  reservation_id uuid,
  message_kind text,
  send_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.cancel_stale_reservation_email_outbox(36);
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
    order by e.send_at desc
    limit greatest(1, least(p_limit, 100))
    for update skip locked
  ) picked
  where o.id = picked.id
  returning o.id, o.reservation_id, o.message_kind, o.send_at;
end;
$$;

comment on function public.cancel_stale_reservation_whatsapp_outbox(integer) is
  'Cron: bricht Erinnerung/Danke ab, die >N Stunden nach send_at noch ungesendet sind.';

comment on function public.cancel_stale_reservation_email_outbox(integer) is
  'Cron: bricht E-Mail Erinnerung/Danke ab, die >N Stunden nach send_at noch ungesendet sind.';

comment on function public.claim_reservation_whatsapp_outbox(integer) is
  'Cron: holt fällige WhatsApp-Outbox-Zeilen atomar (SKIP LOCKED); frische zuerst; Altlasten >36h cancel.';

comment on function public.claim_reservation_email_outbox(integer) is
  'Cron: holt fällige E-Mail-Outbox-Zeilen atomar (SKIP LOCKED); frische zuerst; Altlasten >36h cancel.';
