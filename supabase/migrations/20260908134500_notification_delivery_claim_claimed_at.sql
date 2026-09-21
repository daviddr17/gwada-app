-- Push-Claim: claimed_at wieder setzen + Stale-Release daran koppeln.
-- Regression in 20260622120000 / 20260615220000: Claim ohne claimed_at,
-- release_stale an created_at → Worker-Crash nach erfolgreichem WAHA-Send
-- konnte denselben Delivery erneut freigeben (Doppel-/Dreifachversand).

create or replace function public.claim_notification_deliveries(p_limit integer default 50)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notification_deliveries d
  set
    status = 'processing',
    claimed_at = timezone('utc', now())
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
  'Cron-Worker: holt und sperrt pending Deliveries atomar (SKIP LOCKED); setzt claimed_at.';

create or replace function public.claim_notification_deliveries_for_event(
  p_event_id uuid,
  p_limit integer default 50
)
returns setof public.notification_deliveries
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notification_deliveries d
  set
    status = 'processing',
    claimed_at = timezone('utc', now())
  from (
    select nd.id
    from public.notification_deliveries nd
    where nd.event_id = p_event_id
      and nd.status = 'pending'
      and nd.scheduled_at <= timezone('utc', now())
    order by nd.scheduled_at asc
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  ) picked
  where d.id = picked.id
  returning d.*;
end;
$$;

comment on function public.claim_notification_deliveries_for_event(uuid, integer) is
  'Sofort-Push: pending Deliveries eines Events atomar claimen; setzt claimed_at.';

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
    claimed_at = null,
    last_error = coalesce(last_error, 'processing_timeout')
  where status = 'processing'
    and coalesce(claimed_at, created_at)
      < timezone('utc', now()) - make_interval(mins => greatest(1, p_stale_minutes));

  get diagnostics released = row_count;
  return released;
end;
$$;

comment on function public.release_stale_notification_deliveries(integer) is
  'Gibt hängende processing-Deliveries frei; Alter an claimed_at (Fallback created_at).';
