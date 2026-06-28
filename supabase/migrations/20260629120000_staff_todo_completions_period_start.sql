-- Variante B: eine Completion-Zeile pro (todo, staff, Periode) statt Überschreiben.

alter table public.restaurant_staff_todo_completions
  add column if not exists period_start timestamptz;

-- ad_hoc / ohne Wiederholung: fester Sentinel
update public.restaurant_staff_todo_completions c
set period_start = timestamptz '1970-01-01T00:00:00Z'
from public.restaurant_staff_todos t
where c.todo_id = t.id
  and c.period_start is null
  and (t.recurrence is null or t.recurrence = 'ad_hoc');

-- stündlich
update public.restaurant_staff_todo_completions c
set period_start = (
  date_trunc(
    'hour',
    c.completed_at at time zone coalesce(r.timezone, 'Europe/Berlin')
  ) at time zone coalesce(r.timezone, 'Europe/Berlin')
)
from public.restaurant_staff_todos t
join public.restaurants r on r.id = t.restaurant_id
where c.todo_id = t.id
  and t.recurrence = 'hourly'
  and c.period_start is null;

-- täglich
update public.restaurant_staff_todo_completions c
set period_start = (
  date_trunc(
    'day',
    c.completed_at at time zone coalesce(r.timezone, 'Europe/Berlin')
  ) at time zone coalesce(r.timezone, 'Europe/Berlin')
)
from public.restaurant_staff_todos t
join public.restaurants r on r.id = t.restaurant_id
where c.todo_id = t.id
  and t.recurrence = 'daily'
  and c.period_start is null;

-- wöchentlich (Montag via ISO-Woche)
update public.restaurant_staff_todo_completions c
set period_start = (
  date_trunc(
    'week',
    c.completed_at at time zone coalesce(r.timezone, 'Europe/Berlin')
  ) at time zone coalesce(r.timezone, 'Europe/Berlin')
)
from public.restaurant_staff_todos t
join public.restaurants r on r.id = t.restaurant_id
where c.todo_id = t.id
  and t.recurrence = 'weekly'
  and c.period_start is null;

-- monatlich
update public.restaurant_staff_todo_completions c
set period_start = (
  date_trunc(
    'month',
    c.completed_at at time zone coalesce(r.timezone, 'Europe/Berlin')
  ) at time zone coalesce(r.timezone, 'Europe/Berlin')
)
from public.restaurant_staff_todos t
join public.restaurants r on r.id = t.restaurant_id
where c.todo_id = t.id
  and t.recurrence = 'monthly'
  and c.period_start is null;

-- Fallback für verbleibende Zeilen
update public.restaurant_staff_todo_completions
set period_start = timestamptz '1970-01-01T00:00:00Z'
where period_start is null;

alter table public.restaurant_staff_todo_completions
  alter column period_start set not null;

alter table public.restaurant_staff_todo_completions
  drop constraint if exists restaurant_staff_todo_completions_unique;

alter table public.restaurant_staff_todo_completions
  add constraint restaurant_staff_todo_completions_period_unique
  unique (todo_id, staff_id, period_start);

drop index if exists public.restaurant_staff_todo_completions_todo_staff_completed_idx;

create index restaurant_staff_todo_completions_todo_staff_period_idx
  on public.restaurant_staff_todo_completions (todo_id, staff_id, period_start desc)
  where reopened_at is null;

notify pgrst, 'reload schema';
