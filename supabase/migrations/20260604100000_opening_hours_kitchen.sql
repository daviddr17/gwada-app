-- Separate weekly kitchen hours (Google: moreHours with hoursTypeId KITCHEN).

alter table public.opening_hours
  add column schedule_role text not null default 'business'
  check (schedule_role in ('business', 'kitchen'));

alter table public.opening_hours
  add constraint opening_hours_exception_business_only
  check (kind <> 'exception' or schedule_role = 'business');

drop index if exists public.opening_hours_weekly_one_per_day;

create unique index opening_hours_weekly_one_per_day_role
  on public.opening_hours (restaurant_id, weekday, schedule_role)
  where kind = 'weekly';

comment on column public.opening_hours.schedule_role is
  'business = Restaurant-Öffnungszeiten; kitchen = Küchenzeiten (wöchentlich).';
