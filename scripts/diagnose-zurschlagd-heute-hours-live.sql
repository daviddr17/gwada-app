-- Read-only: Heute-Widget-Stunden vs. geclippte Netto-Stunden (Zur Schlagd)
-- Vergleicht Widget-Logik (starts_at heute, volle Work-Dauer)
-- mit korrekter Übernacht-Clip-/Netto-Logik.

\pset pager off
\timing off

\echo === Restaurant / Tag ===
select
  id::text,
  slug,
  coalesce(timezone, 'Europe/Berlin') as tz,
  (now() at time zone coalesce(timezone, 'Europe/Berlin'))::date as restaurant_today
from public.restaurants
where slug = 'zurschlagd'
limit 1;

\echo === Widget-Logik: Work-Summe (starts_at im Restaurant-Tag, volle Dauer) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug = 'zurschlagd'
  limit 1
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    ((now() at time zone r.tz)::date) as day,
    ( ((now() at time zone r.tz)::date)::timestamp at time zone r.tz ) as t0,
    ( (((now() at time zone r.tz)::date) + 1)::timestamp at time zone r.tz ) as t1
  from rest r
),
entries as (
  select
    e.*,
    greatest(
      0,
      extract(
        epoch from (
          case when e.is_open then now() else e.ends_at end - e.starts_at
        )
      )
    ) as dur_s
  from public.restaurant_staff_work_entries e
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0
    and e.starts_at < w.t1
    and e.entry_type = 'work'
)
select
  round((coalesce(sum(dur_s), 0) / 3600.0)::numeric, 2) as widget_today_work_h,
  count(*) as work_rows,
  count(*) filter (where is_open) as open_work_rows
from entries;

\echo === Pro Mitarbeiter (Widget-Logik) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    ( ((now() at time zone r.tz)::date)::timestamp at time zone r.tz ) as t0,
    ( (((now() at time zone r.tz)::date) + 1)::timestamp at time zone r.tz ) as t1
  from rest r
),
entries as (
  select
    e.staff_id,
    e.is_open,
    greatest(
      0,
      extract(
        epoch from (
          case when e.is_open then now() else e.ends_at end - e.starts_at
        )
      )
    ) as dur_s
  from public.restaurant_staff_work_entries e
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0
    and e.starts_at < w.t1
    and e.entry_type = 'work'
)
select
  s.given_name || ' ' || s.family_name as staff,
  round((sum(e.dur_s) / 3600.0)::numeric, 2) as widget_h,
  count(*) as work_rows,
  bool_or(e.is_open) as has_open
from entries e
join public.restaurant_staff s on s.id = e.staff_id
group by s.id, s.given_name, s.family_name
order by widget_h desc;

\echo === Überlappung + Clip auf Restaurant-Tag (korrekt für Übernacht) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    ( ((now() at time zone r.tz)::date)::timestamp at time zone r.tz ) as t0,
    ( (((now() at time zone r.tz)::date) + 1)::timestamp at time zone r.tz ) as t1
  from rest r
),
overlap as (
  select
    e.*,
    w.t0,
    w.t1,
    greatest(e.starts_at, w.t0) as clip_start,
    least(case when e.is_open then now() else e.ends_at end, w.t1) as clip_end
  from public.restaurant_staff_work_entries e
  join win w on w.restaurant_id = e.restaurant_id
  where e.entry_type in ('work', 'break')
    and (
      (e.is_open = false and e.starts_at < w.t1 and e.ends_at > w.t0)
      or (e.is_open = true and e.starts_at < w.t1)
    )
),
clipped as (
  select
    *,
    greatest(0, extract(epoch from (clip_end - clip_start))) as clip_s
  from overlap
  where clip_end > clip_start
)
select
  round((coalesce(sum(clip_s) filter (where entry_type = 'work'), 0) / 3600.0)::numeric, 2) as clipped_work_h,
  round((coalesce(sum(clip_s) filter (where entry_type = 'break'), 0) / 3600.0)::numeric, 2) as clipped_break_h,
  count(*) filter (where entry_type = 'work') as work_rows_overlap,
  count(*) filter (where entry_type = 'work' and starts_at < t0) as work_started_before_today
from clipped;

\echo === Einträge die vor heute starteten aber heute überlappen ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    ( ((now() at time zone r.tz)::date)::timestamp at time zone r.tz ) as t0,
    ( (((now() at time zone r.tz)::date) + 1)::timestamp at time zone r.tz ) as t1
  from rest r
)
select
  s.given_name || ' ' || s.family_name as staff,
  e.entry_type,
  e.is_open,
  e.starts_at at time zone (select tz from rest) as starts_local,
  case when e.is_open then null else e.ends_at at time zone (select tz from rest) end as ends_local,
  round((
    greatest(
      0,
      extract(
        epoch from (
          least(case when e.is_open then now() else e.ends_at end, w.t1)
          - greatest(e.starts_at, w.t0)
        )
      )
    ) / 3600.0
  )::numeric, 2) as today_portion_h
from public.restaurant_staff_work_entries e
join win w on w.restaurant_id = e.restaurant_id
join public.restaurant_staff s on s.id = e.staff_id
where e.entry_type in ('work', 'break')
  and e.starts_at < w.t0
  and (
    (e.is_open = false and e.ends_at > w.t0)
    or e.is_open = true
  )
order by e.starts_at;

\echo === Offene Segmente (alle, nicht nur heute gestartet) ===
with rest as (
  select id from public.restaurants where slug = 'zurschlagd' limit 1
)
select
  s.given_name || ' ' || s.family_name as staff,
  e.entry_type,
  e.starts_at,
  round((extract(epoch from (now() - e.starts_at)) / 3600.0)::numeric, 2) as open_for_h
from public.restaurant_staff_work_entries e
join rest r on r.id = e.restaurant_id
join public.restaurant_staff s on s.id = e.staff_id
where e.is_open = true
order by e.starts_at;
