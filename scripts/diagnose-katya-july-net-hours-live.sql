-- Read-only: nur Katya Smilyanova (nicht Elmira) — Netto Juli 2026 Zur Schlagd

\pset pager off
\timing off

\echo === Katya month totals ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants
  where slug = 'zurschlagd'
  limit 1
),
staff as (
  select s.id, s.given_name, s.family_name
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya'
    and s.family_name ilike 'smilyanova'
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
  st.id::text as staff_id,
  st.given_name || ' ' || st.family_name as staff,
  round((coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0) / 3600.0)::numeric, 4) as logged_h,
  round((coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0) / 3600.0)::numeric, 4) as break_h,
  round((
    greatest(
      0,
      coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0)
      - coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0)
    ) / 3600.0
  )::numeric, 4) as netto_ui,
  round((
    greatest(
      0,
      coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0)
      - coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0)
    ) / 3600.0
  )::numeric, 1) as netto_ui_1dp,
  count(*) filter (where e.entry_type = 'work') as work_rows,
  count(*) filter (where e.entry_type = 'break') as break_rows
from entries e
join staff st on st.id = e.staff_id
group by st.id, st.given_name, st.family_name;

\echo === Katya per day ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya' and s.family_name ilike 'smilyanova'
),
win as (
  select r.id as restaurant_id, r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
),
entries as (
  select
    e.*,
    (e.starts_at at time zone (select tz from rest))::date as day_local,
    greatest(0, extract(epoch from (case when e.is_open then now() else e.ends_at end - e.starts_at))) as dur_s
  from public.restaurant_staff_work_entries e
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0 and e.starts_at < w.t1
    and e.entry_type in ('work', 'break')
)
select
  day_local,
  round((coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) / 3600.0)::numeric, 4) as work_h,
  round((coalesce(sum(dur_s) filter (where entry_type = 'break'), 0) / 3600.0)::numeric, 4) as break_h,
  round((
    greatest(0,
      coalesce(sum(dur_s) filter (where entry_type = 'work'), 0)
      - coalesce(sum(dur_s) filter (where entry_type = 'break'), 0)
    ) / 3600.0
  )::numeric, 4) as netto_work_minus_break,
  round((coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) / 3600.0)::numeric, 4) as display_style_work_only
from entries
group by day_local
order by day_local;

\echo === Katya per shift_id ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya' and s.family_name ilike 'smilyanova'
),
win as (
  select r.id as restaurant_id, r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
),
entries as (
  select
    e.*,
    greatest(0, extract(epoch from (case when e.is_open then now() else e.ends_at end - e.starts_at))) as dur_s
  from public.restaurant_staff_work_entries e
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0 and e.starts_at < w.t1
    and e.entry_type in ('work', 'break')
),
by_shift as (
  select
    e.shift_id,
    min(e.starts_at at time zone (select tz from rest)) as starts_local,
    max((case when e.is_open then now() else e.ends_at end) at time zone (select tz from rest)) as ends_local,
    coalesce(sum(e.dur_s) filter (where e.entry_type = 'work'), 0) as work_s,
    coalesce(sum(e.dur_s) filter (where e.entry_type = 'break'), 0) as break_s,
    bool_or(
      e.entry_type = 'break'
      and exists (
        select 1 from entries w
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
)
select
  shift_id::text,
  starts_local::timestamp(0) as starts_local,
  ends_local::timestamp(0) as ends_local,
  round((work_s / 3600.0)::numeric, 4) as work_h,
  round((break_s / 3600.0)::numeric, 4) as break_h,
  break_inside_work,
  round(((case when break_inside_work then greatest(0, work_s - break_s) else work_s end) / 3600.0)::numeric, 4)
    as display_row_net_h,
  round((greatest(0, work_s - break_s) / 3600.0)::numeric, 4) as month_formula_net_h
from by_shift
order by starts_local;

\echo === Katya orphans (no shift_id) ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya' and s.family_name ilike 'smilyanova'
),
win as (
  select r.id as restaurant_id, r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
)
select
  (e.starts_at at time zone r.tz)::timestamp(0) as starts_local,
  ((case when e.is_open then now() else e.ends_at end) at time zone r.tz)::timestamp(0) as ends_local,
  e.entry_type,
  e.is_open,
  round((
    greatest(0, extract(epoch from (case when e.is_open then now() else e.ends_at end - e.starts_at))) / 3600.0
  )::numeric, 4) as hours,
  left(coalesce(e.note, ''), 60) as note,
  e.id::text as entry_id
from public.restaurant_staff_work_entries e
join staff st on st.id = e.staff_id
join win w on w.restaurant_id = e.restaurant_id
join rest r on true
where e.starts_at >= w.t0 and e.starts_at < w.t1
  and e.entry_type in ('work', 'break')
  and e.shift_id is null
order by e.starts_at;

\echo === Katya overlapping work intervals ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya' and s.family_name ilike 'smilyanova'
),
win as (
  select r.id as restaurant_id, r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
),
work as (
  select
    e.id,
    e.shift_id,
    e.starts_at,
    case when e.is_open then now() else e.ends_at end as ends_at
  from public.restaurant_staff_work_entries e
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0 and e.starts_at < w.t1
    and e.entry_type = 'work'
)
select
  a.id::text as a_id,
  b.id::text as b_id,
  a.shift_id::text as a_shift,
  b.shift_id::text as b_shift,
  (a.starts_at at time zone (select tz from rest))::timestamp(0) as a_start,
  (a.ends_at at time zone (select tz from rest))::timestamp(0) as a_end,
  (b.starts_at at time zone (select tz from rest))::timestamp(0) as b_start,
  (b.ends_at at time zone (select tz from rest))::timestamp(0) as b_end,
  round((
    extract(epoch from (
      least(a.ends_at, b.ends_at) - greatest(a.starts_at, b.starts_at)
    )) / 3600.0
  )::numeric, 4) as overlap_h
from work a
join work b on a.id < b.id
  and a.starts_at < b.ends_at
  and b.starts_at < a.ends_at
order by overlap_h desc;

\echo === Katya all segments ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya' and s.family_name ilike 'smilyanova'
),
win as (
  select r.id as restaurant_id, r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
)
select
  (e.starts_at at time zone r.tz)::timestamp(0) as starts_local,
  ((case when e.is_open then now() else e.ends_at end) at time zone r.tz)::timestamp(0) as ends_local,
  e.entry_type,
  e.is_open,
  round((
    greatest(0, extract(epoch from (case when e.is_open then now() else e.ends_at end - e.starts_at))) / 3600.0
  )::numeric, 4) as hours,
  left(coalesce(e.note, ''), 40) as note,
  e.shift_id::text as shift_id,
  e.id::text as entry_id
from public.restaurant_staff_work_entries e
join staff st on st.id = e.staff_id
join win w on w.restaurant_id = e.restaurant_id
join rest r on true
where e.starts_at >= w.t0 and e.starts_at < w.t1
  and e.entry_type in ('work', 'break')
order by e.starts_at;

\echo === sums of day display vs month ===
with rest as (
  select id, coalesce(timezone, 'Europe/Berlin') as tz
  from public.restaurants where slug = 'zurschlagd' limit 1
),
staff as (
  select s.id
  from public.restaurant_staff s
  join rest r on r.id = s.restaurant_id
  where s.given_name ilike 'katya' and s.family_name ilike 'smilyanova'
),
win as (
  select r.id as restaurant_id, r.tz,
    (timestamp '2026-07-01 00:00:00' at time zone r.tz) as t0,
    (timestamp '2026-08-01 00:00:00' at time zone r.tz) as t1
  from rest r
),
entries as (
  select
    e.*,
    greatest(0, extract(epoch from (case when e.is_open then now() else e.ends_at end - e.starts_at))) as dur_s
  from public.restaurant_staff_work_entries e
  join staff st on st.id = e.staff_id
  join win w on w.restaurant_id = e.restaurant_id
  where e.starts_at >= w.t0 and e.starts_at < w.t1
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
        select 1 from entries w
        where w.shift_id = e.shift_id and w.entry_type = 'work'
          and e.starts_at >= w.starts_at
          and (case when e.is_open then now() else e.ends_at end)
            <= (case when w.is_open then now() else w.ends_at end) + interval '1 millisecond'
      )
    ) as break_inside_work
  from entries e
  where e.shift_id is not null
  group by e.shift_id
)
select
  round((sum(case when break_inside_work then greatest(0, work_s - break_s) else work_s end) / 3600.0)::numeric, 4)
    as sum_display_shift_nets,
  round((sum(greatest(0, work_s - break_s)) / 3600.0)::numeric, 4) as sum_shift_work_minus_break,
  round((
    (select coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) from entries
      where shift_id is null) / 3600.0
  )::numeric, 4) as orphan_work_h,
  round((
    (select coalesce(sum(dur_s) filter (where entry_type = 'break'), 0) from entries
      where shift_id is null) / 3600.0
  )::numeric, 4) as orphan_break_h,
  round(((select coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) from entries) / 3600.0)::numeric, 4)
    as all_work_h,
  round(((select coalesce(sum(dur_s) filter (where entry_type = 'break'), 0) from entries) / 3600.0)::numeric, 4)
    as all_break_h,
  round((
    greatest(0,
      (select coalesce(sum(dur_s) filter (where entry_type = 'work'), 0) from entries)
      - (select coalesce(sum(dur_s) filter (where entry_type = 'break'), 0) from entries)
    ) / 3600.0
  )::numeric, 4) as month_netto
from by_shift;
