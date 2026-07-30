-- Read-only: Katya Smilyanova / Zur Schlagd — Netto Juli 2026
-- Vergleicht Monatsformel (Work − Break) mit Display-Schicht-Netto (Work, Pause nur bei Overlap)

\pset pager off
\timing off

\echo === restaurant + staff ===
with rest as (
  select id, name, slug, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug ilike '%schlagd%'
     or name ilike '%schlagd%'
     or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
)
select r.id::text, r.name, r.slug, r.tz
from rest r;

with rest as (
  select id from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
)
select
  s.id::text as staff_id,
  s.given_name,
  s.family_name,
  s.is_active
from public.restaurant_staff s
join rest r on r.id = s.restaurant_id
where s.given_name ilike '%katya%'
   or s.family_name ilike '%smily%'
   or (s.given_name ilike '%kat%' and s.family_name ilike '%smil%')
order by s.family_name, s.given_name;

\echo === month totals (UI summarizeStaffWorkEntries) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
staff as (
  select s.id, s.given_name, s.family_name
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike '%katya%'
     or s.family_name ilike '%smily%'
     or (s.given_name ilike '%kat%' and s.family_name ilike '%smil%')
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
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
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0
    and e.starts_at < w.t1
    and e.entry_type in ('work', 'break')
)
select
  st.given_name || ' ' || st.family_name as staff,
  round((sum(e.dur_s) filter (where e.entry_type = 'work') / 3600.0)::numeric, 4) as logged_h,
  round((sum(e.dur_s) filter (where e.entry_type = 'break') / 3600.0)::numeric, 4) as break_h,
  round((
    greatest(
      0,
      coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0)
      - coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0)
    ) / 3600.0
  )::numeric, 4) as netto_ui_work_minus_break,
  round((
    greatest(
      0,
      coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0)
      - coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0)
    ) / 3600.0
  )::numeric, 1) as netto_ui_1dp,
  count(*) filter (where e.entry_type = 'work') as work_rows,
  count(*) filter (where e.entry_type = 'break') as break_rows,
  count(distinct e.shift_id) filter (where e.shift_id is not null) as shift_ids
from entries e
join staff st on st.id = e.staff_id
group by st.given_name, st.family_name;

\echo === per calendar day (Berlin) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike '%katya%'
     or s.family_name ilike '%smily%'
     or (s.given_name ilike '%kat%' and s.family_name ilike '%smil%')
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
),
entries as (
  select
    e.*,
    (e.starts_at at time zone (select tz from rest))::date as day_local,
    greatest(
      0,
      extract(
        epoch from (
          case when e.is_open then now() else e.ends_at end - e.starts_at
        )
      )
    ) as dur_s
  from public.restaurant_staff_work_entries e
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0
    and e.starts_at < w.t1
    and e.entry_type in ('work', 'break')
)
select
  day_local,
  round((sum(dur_s) filter (where entry_type = 'work') / 3600.0)::numeric, 4) as work_h,
  round((sum(dur_s) filter (where entry_type = 'break') / 3600.0)::numeric, 4) as break_h,
  round((
    greatest(
      0,
      coalesce(sum(dur_s) filter (where entry_type = 'work'), 0)
      - coalesce(sum(dur_s) filter (where entry_type = 'break'), 0)
    ) / 3600.0
  )::numeric, 4) as netto_work_minus_break,
  round((coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) / 3600.0)::numeric, 4)
    as netto_display_style_work_only
from entries
group by day_local
order by day_local;

\echo === per display shift (shift_id) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike '%katya%'
     or s.family_name ilike '%smily%'
     or (s.given_name ilike '%kat%' and s.family_name ilike '%smil%')
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
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
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0
    and e.starts_at < w.t1
    and e.entry_type in ('work', 'break')
    and e.shift_id is not null
),
by_shift as (
  select
    e.shift_id,
    min(e.starts_at at time zone (select tz from rest)) as starts_local,
    max(case when e.is_open then now() else e.ends_at end at time zone (select tz from rest)) as ends_local,
    round((sum(e.dur_s) filter (where e.entry_type = 'work') / 3600.0)::numeric, 4) as work_h,
    round((sum(e.dur_s) filter (where e.entry_type = 'break') / 3600.0)::numeric, 4) as break_h,
    -- break inside any work interval? (approx like displayShiftNetWorkHours)
    bool_or(
      e.entry_type = 'break'
      and exists (
        select 1
        from entries w
        where w.shift_id = e.shift_id
          and w.entry_type = 'work'
          and e.starts_at >= w.starts_at
          and (case when e.is_open then now() else e.ends_at end)
            <= (case when w.is_open then now() else w.ends_at end) + interval '1 millisecond'
      )
    ) as break_inside_work
  from entries e
  group by e.shift_id
)
select
  shift_id::text,
  starts_local::timestamp(0) as starts_local,
  ends_local::timestamp(0) as ends_local,
  work_h,
  break_h,
  break_inside_work,
  case
    when break_inside_work then round(greatest(0, work_h - break_h), 4)
    else work_h
  end as display_row_net_h,
  round(greatest(0, work_h - break_h), 4) as month_formula_net_h
from by_shift
order by starts_local;

\echo === shift sum vs month ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike '%katya%'
     or s.family_name ilike '%smily%'
     or (s.given_name ilike '%kat%' and s.family_name ilike '%smil%')
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
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
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0
    and e.starts_at < w.t1
    and e.entry_type in ('work', 'break')
),
by_shift as (
  select
    e.shift_id,
    coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0) as work_s,
    coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0) as break_s,
    bool_or(
      e.entry_type = 'break'
      and exists (
        select 1
        from entries w
        where w.shift_id = e.shift_id
          and w.entry_type = 'work'
          and e.starts_at >= w.starts_at
          and (case when e.is_open then now() else e.ends_at end)
            <= (case when w.is_open then now() else w.ends_at end) + interval '1 millisecond'
      )
    ) as break_inside_work
  from entries e
  where e.shift_id is not null
  group by e.shift_id
),
orphans as (
  select
    coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) as work_s,
    coalesce(sum(dur_s) filter (where entry_type = 'break'), 0) as break_s
  from entries
  where shift_id is null
)
select
  round((sum(
    case when break_inside_work then greatest(0, work_s - break_s) else work_s end
  ) / 3600.0)::numeric, 4) as sum_display_row_nets,
  round((sum(greatest(0, work_s - break_s)) / 3600.0)::numeric, 4) as sum_shift_work_minus_break,
  (select round((work_s / 3600.0)::numeric, 4) from orphans) as orphan_work_h,
  (select round((break_s / 3600.0)::numeric, 4) from orphans) as orphan_break_h,
  round((
    (
      select coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) from entries
    )
    / 3600.0
  )::numeric, 4) as all_work_h,
  round((
    (
      select coalesce(sum(dur_s) filter (where entry_type = 'break'), 0) from entries
    )
    / 3600.0
  )::numeric, 4) as all_break_h
from by_shift;

\echo === raw segments sample (first 80) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug ilike '%schlagd%' or name ilike '%schlagd%' or name ilike '%schlegd%'
  order by created_at nulls last
  limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike '%katya%'
     or s.family_name ilike '%smily%'
     or (s.given_name ilike '%kat%' and s.family_name ilike '%smil%')
),
win as (
  select
    r.id as restaurant_id,
    r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
)
select
  (e.starts_at at time zone r.tz)::timestamp(0) as starts_local,
  (case when e.is_open then now() else e.ends_at end at time zone r.tz)::timestamp(0) as ends_local,
  e.entry_type,
  e.is_open,
  round((
    greatest(
      0,
      extract(
        epoch from (
          case when e.is_open then now() else e.ends_at end - e.starts_at
        )
      )
    ) / 3600.0
  )::numeric, 4) as hours,
  left(coalesce(e.note, ''), 40) as note,
  e.shift_id::text as shift_id,
  e.source
from public.restaurant_staff_work_entries e
join staff st on st.id = e.staff_id
join win w on w.restaurant_id = e.restaurant_id
join rest r on true
where e.starts_at >= w.t0
  and e.starts_at < w.t1
  and e.entry_type in ('work', 'break')
order by e.starts_at
limit 80;
