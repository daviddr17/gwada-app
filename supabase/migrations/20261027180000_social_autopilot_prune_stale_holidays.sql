-- Soft-skip abgelaufene / doppelte offene Feiertags-Drafts (kein Hard-Delete).
-- Behebt Maria-Himmelfahrt-Spam (u. a. zurschlagd) und ähnliche Holiday-Duplikate.
-- Idempotent: nur pending|needs_asset → skipped.

with open_h as (
  select
    s.id,
    s.restaurant_id,
    coalesce(
      nullif(s.source_json->>'date', '')::date,
      (s.planned_at at time zone 'Europe/Berlin')::date
    ) as holiday_date,
    s.created_at
  from public.social_post_suggestions s
  where s.status in ('pending', 'needs_asset')
    and s.slot_kind = 'holiday'
),
today as (
  select (timezone('Europe/Berlin', now()))::date as d
),
ranked as (
  select
    o.*,
    row_number() over (
      partition by o.restaurant_id, o.holiday_date
      order by o.created_at desc nulls last, o.id desc
    ) as rn
  from open_h o
),
to_skip as (
  select id
  from ranked
  where holiday_date is null
     or holiday_date < (select d from today)
     or holiday_date > (select d from today) + 5
     or (
       holiday_date >= (select d from today)
       and holiday_date <= (select d from today) + 5
       and rn > 1
     )
)
update public.social_post_suggestions s
set status = 'skipped'
from to_skip t
where s.id = t.id
  and s.status in ('pending', 'needs_asset');
