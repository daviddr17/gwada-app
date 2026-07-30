-- Flood-Cleanup nach unguarded Review-Push-Trigger:
-- 1) offene notification_events für alte/historische Reviews abschließen
-- 2) zugehörige pending Deliveries canceln
-- 3) Cache-Reviews älter als 7 Tage für alle Staff-Profile als gelesen markieren
--    (sonst füllt die Glocke nach Dismiss aus dem Unread-Pool nach)

-- 1 + 2: Events ohne reviewCreatedAt (alter Trigger) oder älter als 7 Tage
with flood_events as (
  select e.id
  from public.notification_events e
  where e.module = 'reviews'
    and e.processed_at is null
    and (
      nullif(trim(e.payload->>'reviewCreatedAt'), '') is null
      or (nullif(trim(e.payload->>'reviewCreatedAt'), ''))::timestamptz
        < timezone('utc', now()) - interval '7 days'
    )
)
update public.notification_events e
set
  processed_at = timezone('utc', now()),
  processing_started_at = coalesce(e.processing_started_at, timezone('utc', now()))
from flood_events f
where e.id = f.id;

update public.notification_deliveries d
set
  status = 'failed',
  last_error = coalesce(d.last_error, 'reviews_flood_cleanup')
where d.status in ('pending', 'processing')
  and d.event_id in (
    select e.id
    from public.notification_events e
    where e.module = 'reviews'
      and (
        nullif(trim(e.payload->>'reviewCreatedAt'), '') is null
        or (nullif(trim(e.payload->>'reviewCreatedAt'), ''))::timestamptz
          < timezone('utc', now()) - interval '7 days'
        or e.processed_at is not null
      )
  )
  and d.created_at > timezone('utc', now()) - interval '14 days';

-- 3: Alte Cache-Reviews → read für alle verknüpften Staff-User
insert into public.restaurant_review_reads (
  restaurant_id,
  user_id,
  platform,
  review_id,
  read_at,
  marked_unread_at
)
select
  c.restaurant_id,
  s.profile_id,
  c.platform,
  c.external_id,
  timezone('utc', now()),
  null
from public.restaurant_reviews_platform_cache c
inner join public.restaurant_staff s
  on s.restaurant_id = c.restaurant_id
 and s.profile_id is not null
 and s.is_active is distinct from false
where coalesce(c.created_at, timezone('utc', now()))
  < timezone('utc', now()) - interval '7 days'
on conflict (restaurant_id, user_id, platform, review_id) do update
set
  read_at = coalesce(public.restaurant_review_reads.read_at, excluded.read_at),
  marked_unread_at = case
    when public.restaurant_review_reads.read_at is null then null
    else public.restaurant_review_reads.marked_unread_at
  end;

-- Gwada-Reviews älter als 7 Tage ebenfalls
insert into public.restaurant_review_reads (
  restaurant_id,
  user_id,
  platform,
  review_id,
  read_at,
  marked_unread_at
)
select
  g.restaurant_id,
  s.profile_id,
  'gwada',
  g.id::text,
  timezone('utc', now()),
  null
from public.gwada_reviews g
inner join public.restaurant_staff s
  on s.restaurant_id = g.restaurant_id
 and s.profile_id is not null
 and s.is_active is distinct from false
where g.created_at < timezone('utc', now()) - interval '7 days'
on conflict (restaurant_id, user_id, platform, review_id) do update
set
  read_at = coalesce(public.restaurant_review_reads.read_at, excluded.read_at),
  marked_unread_at = case
    when public.restaurant_review_reads.read_at is null then null
    else public.restaurant_review_reads.marked_unread_at
  end;
