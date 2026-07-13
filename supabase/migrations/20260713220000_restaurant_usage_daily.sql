-- Gwada Usage Insights: Tages-Aggregate (keine IPs, keine Raw-Events)

create table if not exists public.restaurant_usage_daily (
  restaurant_id uuid not null
    references public.restaurants (id) on delete cascade,
  day date not null,
  source text not null
    check (source in ('embed', 'api', 'profile')),
  -- z. B. reservation | menu | view | module:menu | api:reviews
  dimension text not null
    check (
      char_length(dimension) between 1 and 64
      and dimension ~ '^[a-z0-9_.:-]+$'
    ),
  count bigint not null default 0
    check (count >= 0),
  primary key (restaurant_id, day, source, dimension)
);

comment on table public.restaurant_usage_daily is
  'Tages-Aggregate für Gwada Insights (Embed-Aufrufe, API-Nutzung, Profil). Keine IPs/User-Agents.';

create index if not exists restaurant_usage_daily_restaurant_day_idx
  on public.restaurant_usage_daily (restaurant_id, day desc);

alter table public.restaurant_usage_daily enable row level security;

create policy restaurant_usage_daily_select_staff
  on public.restaurant_usage_daily
  for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'insights')
  );

-- Schreiben nur über Admin/Service-Role (+ security-definer RPC unten).
-- Keine INSERT/UPDATE-Policies für authenticated.

create or replace function public.increment_restaurant_usage_daily(
  p_restaurant_id uuid,
  p_day date,
  p_source text,
  p_dimension text,
  p_delta bigint default 1
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_delta is null or p_delta < 1 or p_delta > 100 then
    raise exception 'invalid_delta';
  end if;
  if p_source is null or p_source not in ('embed', 'api', 'profile') then
    raise exception 'invalid_source';
  end if;
  if p_dimension is null
     or char_length(p_dimension) < 1
     or char_length(p_dimension) > 64
     or p_dimension !~ '^[a-z0-9_.:-]+$' then
    raise exception 'invalid_dimension';
  end if;

  insert into public.restaurant_usage_daily (
    restaurant_id, day, source, dimension, count
  )
  values (p_restaurant_id, p_day, p_source, p_dimension, p_delta)
  on conflict (restaurant_id, day, source, dimension)
  do update set count = public.restaurant_usage_daily.count + excluded.count;
end;
$$;

revoke all on function public.increment_restaurant_usage_daily(uuid, date, text, text, bigint)
  from public;
grant execute on function public.increment_restaurant_usage_daily(uuid, date, text, text, bigint)
  to service_role;
