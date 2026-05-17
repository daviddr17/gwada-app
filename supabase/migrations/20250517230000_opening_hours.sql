-- Normalized opening hours per restaurant (weekly template + dated exceptions).
-- Replaces embedding weeklyHours / dateExceptions in restaurant_app_state for UUID restaurants.

create table public.opening_hours (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  kind text not null check (kind in ('weekly', 'exception')),
  weekday text null check (
    weekday is null
    or weekday in (
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday'
    )
  ),
  exception_date date null,
  closed boolean not null default false,
  opens_at time without time zone null,
  closes_at time without time zone null,
  note text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint opening_hours_shape check (
    (
      kind = 'weekly'
      and weekday is not null
      and exception_date is null
    )
    or (
      kind = 'exception'
      and exception_date is not null
      and weekday is null
    )
  ),
  constraint opening_hours_times_when_open check (
    closed
    or (opens_at is not null and closes_at is not null)
  )
);

create unique index opening_hours_weekly_one_per_day
  on public.opening_hours (restaurant_id, weekday)
  where kind = 'weekly';

create unique index opening_hours_exception_one_per_date
  on public.opening_hours (restaurant_id, exception_date)
  where kind = 'exception';

create index opening_hours_restaurant_idx
  on public.opening_hours (restaurant_id);

create trigger opening_hours_set_updated_at
  before update on public.opening_hours
  for each row execute function public.set_updated_at();

alter table public.opening_hours enable row level security;

create policy "opening_hours_staff_all"
  on public.opening_hours for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.opening_hours is
  'Weekly default hours (one row per weekday) and date-specific exceptions; replaces JSON in restaurant_app_state for workspace restaurants.';
