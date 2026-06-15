-- Sofort-Push nach Webhook: Event/Delivery gezielt claimen (kein Doppel-Fan-out / Doppelversand).

-- Event-Claim wieder mit processing_started_at (Fan-out vor processed_at).
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
  set processing_started_at = timezone('utc', now())
  from (
    select ne.id
    from public.notification_events ne
    where ne.processed_at is null
      and ne.processing_started_at is null
    order by ne.created_at asc
    limit greatest(1, least(p_limit, 200))
    for update skip locked
  ) picked
  where e.id = picked.id
  returning e.*;
end;
$$;

create or replace function public.claim_notification_event_by_id(p_event_id uuid)
returns setof public.notification_events
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  update public.notification_events e
  set processing_started_at = timezone('utc', now())
  where e.id = p_event_id
    and e.processed_at is null
    and e.processing_started_at is null
  returning e.*;
end;
$$;

comment on function public.claim_notification_event_by_id(uuid) is
  'Sofort-Push: sperrt ein Event für Fan-out (SKIP wenn schon verarbeitet oder anderer Worker).';

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
  set status = 'processing'
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
  'Sofort-Push: pending Deliveries eines Events atomar claimen (parallel zum Cron).';
