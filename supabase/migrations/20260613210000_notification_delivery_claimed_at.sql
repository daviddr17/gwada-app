-- Delivery-Claim: claimed_at für zuverlässiges Stale-Release (Worker-Timeout nach Claim, attempts bleibt 0).

alter table public.notification_deliveries
  add column if not exists claimed_at timestamptz;

comment on column public.notification_deliveries.claimed_at is
  'Zeitpunkt des letzten Worker-Claims (status → processing); Basis für release_stale.';

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

-- Hängende processing-Zeilen einmalig freigeben (z. B. nach Worker-Abbruch vor markDeliveryOutcome).
update public.notification_deliveries
set
  status = 'pending',
  claimed_at = null,
  last_error = coalesce(last_error, 'processing_timeout')
where status = 'processing'
  and coalesce(claimed_at, created_at)
    < timezone('utc', now()) - interval '15 minutes';
