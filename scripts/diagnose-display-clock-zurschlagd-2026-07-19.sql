-- Read-only: Display-Clock Events + Stempel für Zur Schlagd am 2026-07-19
-- Fokus Lukas Dreyer / Pascal Glor um ~11:16 und ~11:31 (Europe/Berlin)

\pset pager off
\timing off

with rest as (
  select id, name, slug, timezone
  from public.restaurants
  where slug ilike '%schlagd%'
     or name ilike '%schlagd%'
     or name ilike '%schlegd%'
  order by created_at nulls last
  limit 5
)
select 'restaurants' as section, r.id::text, r.name, r.slug, coalesce(r.timezone, 'Europe/Berlin') as timezone
from rest r;

with rest as (
  select id from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
)
select
  'staff' as section,
  s.id::text as staff_id,
  s.given_name,
  s.family_name,
  s.active::text as active
from public.restaurant_staff s
join rest r on r.id = s.restaurant_id
where (
  (s.given_name ilike '%lukas%' and s.family_name ilike '%dreyer%')
  or (s.given_name ilike '%pascal%' and s.family_name ilike '%glor%')
  or s.family_name ilike '%dreyer%'
  or s.family_name ilike '%glor%'
)
order by s.family_name, s.given_name;

-- Fenster: 2026-07-19 09:00–14:00 Europe/Berlin → UTC
\echo === notification_events (display clock) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as timezone
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
win as (
  select
    r.id as restaurant_id,
    (timestamp '2026-07-19 09:00:00' at time zone r.timezone) as t0,
    (timestamp '2026-07-19 14:00:00' at time zone r.timezone) as t1
  from rest r
)
select
  e.created_at at time zone 'Europe/Berlin' as created_berlin,
  e.module,
  e.reference_id::text as shift_id,
  e.payload->>'staffId' as staff_id,
  e.payload->>'staffName' as staff_name,
  e.payload->>'action' as action,
  e.payload->>'at' as payload_at,
  e.id::text as event_id
from public.notification_events e
join win w on w.restaurant_id = e.restaurant_id
where e.module in ('staff_display_clock_in', 'staff_display_clock_out')
  and e.created_at >= w.t0
  and e.created_at < w.t1
order by e.created_at;

\echo === notification_deliveries (whatsapp/email) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as timezone
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
win as (
  select
    r.id as restaurant_id,
    (timestamp '2026-07-19 09:00:00' at time zone r.timezone) as t0,
    (timestamp '2026-07-19 14:00:00' at time zone r.timezone) as t1
  from rest r
)
select
  d.sent_at at time zone 'Europe/Berlin' as sent_berlin,
  d.channel,
  d.status,
  e.module,
  e.payload->>'staffName' as staff_name,
  e.payload->>'action' as action,
  e.reference_id::text as shift_id,
  left(coalesce(d.last_error, ''), 80) as last_error
from public.notification_deliveries d
join public.notification_events e on e.id = d.event_id
join win w on w.restaurant_id = e.restaurant_id
where e.module in ('staff_display_clock_in', 'staff_display_clock_out')
  and coalesce(d.sent_at, d.created_at) >= w.t0
  and coalesce(d.sent_at, d.created_at) < w.t1
order by coalesce(d.sent_at, d.created_at);

\echo === work_entries Lukas + Pascal (Display) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as timezone
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
staff as (
  select s.id, s.given_name, s.family_name
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where (s.given_name ilike '%lukas%' and s.family_name ilike '%dreyer%')
     or (s.given_name ilike '%pascal%' and s.family_name ilike '%glor%')
),
win as (
  select
    r.id as restaurant_id,
    (timestamp '2026-07-18 00:00:00' at time zone r.timezone) as t0,
    (timestamp '2026-07-20 00:00:00' at time zone r.timezone) as t1
  from rest r
)
select
  st.given_name || ' ' || st.family_name as staff,
  e.entry_type,
  e.starts_at at time zone 'Europe/Berlin' as starts_berlin,
  e.ends_at at time zone 'Europe/Berlin' as ends_berlin,
  e.is_open,
  e.note,
  e.shift_id::text as shift_id,
  e.id::text as entry_id
from public.restaurant_staff_work_entries e
join staff st on st.id = e.staff_id
join win w on w.restaurant_id = e.restaurant_id
where e.starts_at >= w.t0
  and e.starts_at < w.t1
order by st.family_name, e.starts_at;

-- trigger run
