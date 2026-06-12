-- Push-Zustellung: parallele Cron-Worker dürfen dieselbe Delivery nicht doppelt senden.
-- claim_notification_deliveries nutzt FOR UPDATE SKIP LOCKED.

alter table public.notification_deliveries
  drop constraint if exists notification_deliveries_status_check;

alter table public.notification_deliveries
  add constraint notification_deliveries_status_check
  check (status in ('pending', 'processing', 'sent', 'failed'));

comment on column public.notification_deliveries.status is
  'pending → processing (Claim) → sent|failed; processing verhindert Doppelversand.';

create or replace function public.claim_notification_deliveries(p_limit integer default 50)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notification_deliveries d
  set status = 'processing'
  from (
    select nd.id
    from public.notification_deliveries nd
    where nd.status = 'pending'
      and nd.scheduled_at <= timezone('utc', now())
    order by nd.scheduled_at asc
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  ) picked
  where d.id = picked.id
  returning d.*;
end;
$$;

comment on function public.claim_notification_deliveries(integer) is
  'Cron-Worker: holt und sperrt pending Deliveries atomar (SKIP LOCKED).';

-- Hängende processing-Zeilen nach Timeout wieder freigeben (z. B. Worker-Crash nach WAHA-Send).
create or replace function public.release_stale_notification_deliveries(
  p_stale_minutes integer default 15
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.notification_deliveries
  set
    status = 'pending',
    last_error = coalesce(last_error, 'processing_timeout')
  where status = 'processing'
    and created_at < timezone('utc', now()) - make_interval(mins => greatest(1, p_stale_minutes));

  get diagnostics released = row_count;
  return released;
end;
$$;

create or replace function public.claim_unprocessed_notification_events(
  p_limit integer default 50
)
returns setof public.notification_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notification_events e
  set processed_at = timezone('utc', now())
  from (
    select ne.id
    from public.notification_events ne
    where ne.processed_at is null
    order by ne.created_at asc
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  ) picked
  where e.id = picked.id
  returning e.*;
end;
$$;

comment on function public.claim_unprocessed_notification_events(integer) is
  'Cron-Worker: markiert Events atomar als verarbeitet bevor Fan-out (kein Doppel-Fan-out).';
