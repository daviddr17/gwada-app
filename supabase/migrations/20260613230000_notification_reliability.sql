-- Push-Zuverlässigkeit: Event-Lock erst bei Fan-out, processed_at erst danach; hängende Locks/Events reparieren.

alter table public.notification_events
  add column if not exists processing_started_at timestamptz;

comment on column public.notification_events.processing_started_at is
  'Worker-Lock während Fan-out (processed_at bleibt null bis Abschluss).';

create index if not exists notification_events_unprocessed_lock_idx
  on public.notification_events (created_at)
  where processed_at is null and processing_started_at is null;

-- Lock ohne processed_at — Fan-out muss explizit abschließen.
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

comment on function public.claim_unprocessed_notification_events(integer) is
  'Cron: sperrt unverarbeitete Events für Fan-out (processed_at erst nach complete).';

create or replace function public.complete_notification_event_processing(
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set
    processed_at = timezone('utc', now()),
    processing_started_at = null
  where id = p_event_id
    and processing_started_at is not null
    and processed_at is null;

  return found;
end;
$$;

create or replace function public.release_notification_event_lock(
  p_event_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.notification_events
  set processing_started_at = null
  where id = p_event_id
    and processed_at is null;

  return found;
end;
$$;

create or replace function public.release_stale_notification_event_locks(
  p_stale_minutes integer default 5
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  released integer;
begin
  update public.notification_events
  set processing_started_at = null
  where processed_at is null
    and processing_started_at is not null
    and processing_started_at
      < timezone('utc', now()) - make_interval(mins => greatest(1, p_stale_minutes));

  get diagnostics released = row_count;
  return released;
end;
$$;

-- Events, die fälschlich processed_at haben aber nie Deliveries (Worker-Abbruch nach altem Claim).
update public.notification_events e
set
  processed_at = null,
  processing_started_at = null
where e.processed_at is not null
  and not exists (
    select 1
    from public.notification_deliveries d
    where d.event_id = e.id
  )
  and e.module in (
    'messages',
    'reviews',
    'changelog',
    'reservations_pending',
    'reservations_change_request',
    'reservations_cancellation',
    'staff_shift_start',
    'staff_shift_end',
    'inventory_low_stock'
  );
