-- Plattform-Statistik (Superadmin): Website-Besuche und Produktnutzung.
-- Kein IP, kein roher User-Agent. Land nur als ISO-Code aus dem Edge-Header.

create table public.platform_page_views (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default timezone('utc', now()),
  path text not null,
  surface text not null,
  referrer_host text,
  device text not null,
  browser text not null,
  country_code char(2),
  visitor_id uuid not null,
  session_id uuid not null,
  constraint platform_page_views_path_len check (char_length(path) between 1 and 300),
  constraint platform_page_views_surface_len check (char_length(surface) between 1 and 32),
  constraint platform_page_views_device check (
    device in ('desktop', 'mobile', 'tablet', 'unknown')
  ),
  constraint platform_page_views_browser_len check (char_length(browser) between 1 and 32),
  constraint platform_page_views_referrer_len check (
    referrer_host is null or char_length(referrer_host) between 1 and 200
  ),
  constraint platform_page_views_country check (
    country_code is null or country_code ~ '^[A-Z]{2}$'
  )
);

comment on table public.platform_page_views is
  'First-Party-Seitenaufrufe der öffentlichen Website. visitor_id ist eine zufällige Cookie-ID, kein IP.';

comment on column public.platform_page_views.country_code is
  'ISO-3166-1 alpha-2 aus einem Edge-Header (z. B. cf-ipcountry). Keine IP-Adresse.';

comment on column public.platform_page_views.referrer_host is
  'Nur der Host eines externen Referrers, ohne Pfad und Query.';

create index platform_page_views_occurred_at_idx
  on public.platform_page_views (occurred_at desc);

create table public.platform_usage_events (
  id uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default timezone('utc', now()),
  kind text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  restaurant_id uuid references public.restaurants (id) on delete set null,
  module_id text,
  path text,
  login_method text,
  constraint platform_usage_events_kind check (kind in ('login', 'module_view')),
  constraint platform_usage_events_module_len check (
    module_id is null or char_length(module_id) between 1 and 40
  ),
  constraint platform_usage_events_path_len check (
    path is null or char_length(path) between 1 and 300
  ),
  constraint platform_usage_events_method_len check (
    login_method is null or char_length(login_method) between 1 and 24
  )
);

comment on table public.platform_usage_events is
  'Anmeldungen und Modulaufrufe der angemeldeten App. Keine IP, kein User-Agent.';

create index platform_usage_events_occurred_kind_idx
  on public.platform_usage_events (occurred_at desc, kind);

create index platform_usage_events_profile_occurred_idx
  on public.platform_usage_events (profile_id, occurred_at desc)
  where profile_id is not null;

create index platform_usage_events_restaurant_occurred_idx
  on public.platform_usage_events (restaurant_id, occurred_at desc)
  where restaurant_id is not null;

alter table public.platform_page_views enable row level security;
alter table public.platform_usage_events enable row level security;

revoke all on table public.platform_page_views from public, anon, authenticated;
revoke all on table public.platform_usage_events from public, anon, authenticated;
grant select, insert on table public.platform_page_views to service_role;
grant select, insert on table public.platform_usage_events to service_role;

-- ---------------------------------------------------------------------------
-- Website-Auswertung (nur service_role; die API prüft Superadmin)
-- ---------------------------------------------------------------------------

create or replace function public.platform_website_analytics(
  p_from timestamptz,
  p_to timestamptz,
  p_device text,
  p_browser text,
  p_country text,
  p_surface text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_device text := nullif(nullif(btrim(coalesce(p_device, '')), ''), 'all');
  v_browser text := nullif(nullif(btrim(coalesce(p_browser, '')), ''), 'all');
  v_country text := nullif(nullif(btrim(coalesce(p_country, '')), ''), 'all');
  v_surface text := nullif(nullif(btrim(coalesce(p_surface, '')), ''), 'all');
  v_bucket text;
  v_step interval;
  v_start timestamp;
  v_end timestamp;
  result jsonb;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'range_too_wide' using errcode = '22023';
  end if;

  v_bucket := case
    when p_to - p_from <= interval '48 hours' then 'hour'
    else 'day'
  end;
  v_step := case when v_bucket = 'hour' then interval '1 hour' else interval '1 day' end;
  v_start := date_trunc(v_bucket, p_from at time zone 'Europe/Berlin');
  v_end := date_trunc(v_bucket, (p_to - interval '1 millisecond') at time zone 'Europe/Berlin');
  if v_end < v_start then
    v_end := v_start;
  end if;

  with in_range as (
    select *
    from public.platform_page_views v
    where v.occurred_at >= p_from
      and v.occurred_at < p_to
  ),
  filtered as (
    select *
    from in_range v
    where (v_device is null or v.device = v_device)
      and (v_browser is null or v.browser = v_browser)
      and (
        v_country is null
        or (v_country = '__none' and v.country_code is null)
        or (
          char_length(v_country) = 2
          and btrim(v.country_code::text) = v_country
        )
      )
      and (v_surface is null or v.surface = v_surface)
  ),
  kpis as (
    select
      count(*)::bigint as page_views,
      count(distinct session_id)::bigint as visits,
      count(distinct visitor_id)::bigint as visitors
    from filtered
  ),
  slots as (
    select gs as bucket_start
    from generate_series(v_start, v_end, v_step) as gs
  ),
  series_raw as (
    select
      date_trunc(v_bucket, occurred_at at time zone 'Europe/Berlin') as bucket_start,
      count(*)::bigint as page_views,
      count(distinct session_id)::bigint as visits,
      count(distinct visitor_id)::bigint as visitors
    from filtered
    group by 1
  )
  select jsonb_build_object(
    'pageViews', (select page_views from kpis),
    'visits', (select visits from kpis),
    'visitors', (select visitors from kpis),
    'bucket', v_bucket,
    'series', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label', to_char(
            s.bucket_start,
            case when v_bucket = 'hour' then 'DD.MM. HH24:00' else 'DD.MM.YY' end
          ),
          'pageViews', coalesce(r.page_views, 0),
          'visits', coalesce(r.visits, 0),
          'visitors', coalesce(r.visitors, 0)
        )
        order by s.bucket_start
      )
      from slots s
      left join series_raw r on r.bucket_start = s.bucket_start
    ), '[]'::jsonb),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'path', t.path,
        'surface', t.surface,
        'pageViews', t.page_views,
        'visits', t.visits,
        'visitors', t.visitors
      ) order by t.page_views desc, t.path)
      from (
        select
          path,
          min(surface) as surface,
          count(*)::bigint as page_views,
          count(distinct session_id)::bigint as visits,
          count(distinct visitor_id)::bigint as visitors
        from filtered
        group by path
        order by count(*) desc, path
        limit 200
      ) t
    ), '[]'::jsonb),
    'referrers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'host', t.host,
        'visits', t.visits,
        'pageViews', t.page_views
      ) order by t.visits desc, t.host)
      from (
        select
          coalesce(referrer_host, '') as host,
          count(distinct session_id)::bigint as visits,
          count(*)::bigint as page_views
        from filtered
        group by 1
        order by count(distinct session_id) desc, 1
        limit 100
      ) t
    ), '[]'::jsonb),
    'devices', coalesce((
      select jsonb_agg(jsonb_build_object(
        'device', device,
        'pageViews', page_views,
        'visits', visits
      ) order by page_views desc, device)
      from (
        select
          device,
          count(*)::bigint as page_views,
          count(distinct session_id)::bigint as visits
        from filtered
        group by device
      ) t
    ), '[]'::jsonb),
    'browsers', coalesce((
      select jsonb_agg(jsonb_build_object(
        'browser', browser,
        'pageViews', page_views,
        'visits', visits
      ) order by page_views desc, browser)
      from (
        select
          browser,
          count(*)::bigint as page_views,
          count(distinct session_id)::bigint as visits
        from filtered
        group by browser
      ) t
    ), '[]'::jsonb),
    'countries', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', t.code,
        'name', t.name,
        'pageViews', t.page_views,
        'visitors', t.visitors
      ) order by t.page_views desc, t.name)
      from (
        select
          coalesce(v.country_code, '') as code,
          coalesce(
            c.name_de,
            case when v.country_code is null then 'Unbekannt' else v.country_code end
          ) as name,
          count(*)::bigint as page_views,
          count(distinct v.visitor_id)::bigint as visitors
        from filtered v
        left join public.countries c on c.iso2 = v.country_code
        group by 1, 2
        order by count(*) desc, 2
        limit 250
      ) t
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'devices', coalesce((
        select jsonb_agg(distinct device) from in_range
      ), '[]'::jsonb),
      'browsers', coalesce((
        select jsonb_agg(distinct browser) from in_range
      ), '[]'::jsonb),
      'surfaces', coalesce((
        select jsonb_agg(distinct surface) from in_range
      ), '[]'::jsonb),
      'countries', coalesce((
        select jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name) order by x.name)
        from (
          select distinct
            coalesce(v.country_code, '__none') as code,
            coalesce(
              c.name_de,
              case when v.country_code is null then 'Unbekannt' else v.country_code end
            ) as name
          from in_range v
          left join public.countries c on c.iso2 = v.country_code
        ) x
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.platform_website_analytics(timestamptz, timestamptz, text, text, text, text)
  from public, anon, authenticated;
grant execute on function public.platform_website_analytics(timestamptz, timestamptz, text, text, text, text)
  to service_role;

-- ---------------------------------------------------------------------------
-- Produktnutzung
-- ---------------------------------------------------------------------------

create or replace function public.platform_product_usage(
  p_from timestamptz,
  p_to timestamptz,
  p_module text,
  p_restaurant uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_module text := nullif(nullif(btrim(coalesce(p_module, '')), ''), 'all');
  v_restaurant uuid := p_restaurant;
  v_bucket text;
  v_step interval;
  v_start timestamp;
  v_end timestamp;
  result jsonb;
begin
  if p_from is null or p_to is null or p_to <= p_from then
    raise exception 'invalid_range' using errcode = '22023';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'range_too_wide' using errcode = '22023';
  end if;
  if v_module is not null and v_module !~ '^[a-z0-9_-]{1,40}$' then
    v_module := null;
  end if;

  v_bucket := case
    when p_to - p_from <= interval '48 hours' then 'hour'
    else 'day'
  end;
  v_step := case when v_bucket = 'hour' then interval '1 hour' else interval '1 day' end;
  v_start := date_trunc(v_bucket, p_from at time zone 'Europe/Berlin');
  v_end := date_trunc(v_bucket, (p_to - interval '1 millisecond') at time zone 'Europe/Berlin');
  if v_end < v_start then
    v_end := v_start;
  end if;

  with in_range as (
    select *
    from public.platform_usage_events e
    where e.occurred_at >= p_from
      and e.occurred_at < p_to
  ),
  events as (
    select *
    from in_range e
    where v_restaurant is null
      or e.restaurant_id = v_restaurant
      or (
        e.kind = 'login'
        and exists (
          select 1
          from public.restaurant_employees emp
          where emp.restaurant_id = v_restaurant
            and emp.profile_id = e.profile_id
            and emp.is_active
        )
      )
  ),
  module_events as (
    select *
    from events e
    where e.kind = 'module_view'
      and (v_module is null or e.module_id = v_module)
  ),
  login_events as (
    select *
    from events e
    where e.kind = 'login'
  ),
  slots as (
    select gs as bucket_start
    from generate_series(v_start, v_end, v_step) as gs
  ),
  login_buckets as (
    select
      date_trunc(v_bucket, occurred_at at time zone 'Europe/Berlin') as bucket_start,
      count(*)::bigint as count
    from login_events
    group by 1
  ),
  module_buckets as (
    select
      date_trunc(v_bucket, occurred_at at time zone 'Europe/Berlin') as bucket_start,
      count(*)::bigint as count
    from module_events
    group by 1
  ),
  login_by_user as (
    select
      profile_id,
      count(*)::bigint as logins,
      max(occurred_at) as last_login
    from login_events
    where profile_id is not null
    group by profile_id
  ),
  module_by_user as (
    select
      profile_id,
      count(*)::bigint as module_views,
      count(distinct restaurant_id) filter (where restaurant_id is not null)::bigint as restaurant_count,
      max(occurred_at) as last_module
    from module_events
    where profile_id is not null
    group by profile_id
  ),
  user_ids as (
    select profile_id from module_by_user
    union
    select profile_id from login_by_user where v_module is null
  ),
  top_module_user as (
    select distinct on (profile_id)
      profile_id,
      module_id as top_module
    from (
      select profile_id, module_id, count(*) as n
      from module_events
      where profile_id is not null
        and module_id is not null
      group by profile_id, module_id
    ) c
    order by profile_id, n desc, module_id
  ),
  module_by_restaurant as (
    select
      restaurant_id,
      count(*)::bigint as module_views,
      count(distinct profile_id) filter (where profile_id is not null)::bigint as users,
      max(occurred_at) as last_at
    from module_events
    where restaurant_id is not null
    group by restaurant_id
  ),
  employee_logins as (
    select
      emp.restaurant_id,
      count(*)::bigint as logins
    from login_events l
    join public.restaurant_employees emp
      on emp.profile_id = l.profile_id
     and emp.is_active
    where l.profile_id is not null
      and (v_restaurant is null or emp.restaurant_id = v_restaurant)
    group by emp.restaurant_id
  ),
  restaurant_ids as (
    select restaurant_id as id from module_by_restaurant
    union
    select restaurant_id from employee_logins where v_module is null
  ),
  top_module_restaurant as (
    select distinct on (restaurant_id)
      restaurant_id,
      module_id as top_module
    from (
      select restaurant_id, module_id, count(*) as n
      from module_events
      where restaurant_id is not null
        and module_id is not null
      group by restaurant_id, module_id
    ) c
    order by restaurant_id, n desc, module_id
  )
  select jsonb_build_object(
    'activeUsers', (select count(*)::bigint from user_ids),
    'activeRestaurants', (select count(*)::bigint from restaurant_ids),
    'logins', (select count(*)::bigint from login_events),
    'moduleViews', (select count(*)::bigint from module_events),
    'bucket', v_bucket,
    'loginSeries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label', to_char(
            s.bucket_start,
            case when v_bucket = 'hour' then 'DD.MM. HH24:00' else 'DD.MM.YY' end
          ),
          'count', coalesce(b.count, 0)
        )
        order by s.bucket_start
      )
      from slots s
      left join login_buckets b on b.bucket_start = s.bucket_start
    ), '[]'::jsonb),
    'moduleSeries', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'label', to_char(
            s.bucket_start,
            case when v_bucket = 'hour' then 'DD.MM. HH24:00' else 'DD.MM.YY' end
          ),
          'count', coalesce(b.count, 0)
        )
        order by s.bucket_start
      )
      from slots s
      left join module_buckets b on b.bucket_start = s.bucket_start
    ), '[]'::jsonb),
    'modules', coalesce((
      select jsonb_agg(jsonb_build_object(
        'moduleId', t.module_id,
        'views', t.views,
        'users', t.users,
        'restaurants', t.restaurants
      ) order by t.views desc, t.module_id)
      from (
        select
          module_id,
          count(*)::bigint as views,
          count(distinct profile_id) filter (where profile_id is not null)::bigint as users,
          count(distinct restaurant_id) filter (where restaurant_id is not null)::bigint as restaurants
        from module_events
        where module_id is not null
        group by module_id
      ) t
    ), '[]'::jsonb),
    'loginMethods', coalesce((
      select jsonb_agg(jsonb_build_object(
        'method', t.method,
        'count', t.total
      ) order by t.total desc, t.method)
      from (
        select
          coalesce(nullif(login_method, ''), 'unknown') as method,
          count(*)::bigint as total
        from login_events
        group by 1
      ) t
    ), '[]'::jsonb),
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'profileId', t.profile_id,
        'name', t.name,
        'email', t.email,
        'logins', t.logins,
        'moduleViews', t.module_views,
        'restaurantCount', t.restaurant_count,
        'topModule', t.top_module,
        'lastAt', t.last_at
      ) order by t.module_views desc, t.logins desc, t.name)
      from (
        select
          ids.profile_id,
          coalesce(
            nullif(trim(concat_ws(' ', p.given_name, p.family_name)), ''),
            nullif(trim(p.display_name), ''),
            nullif(trim(u.email::text), ''),
            'Unbekannt'
          ) as name,
          nullif(trim(u.email::text), '') as email,
          coalesce(lb.logins, 0) as logins,
          coalesce(mb.module_views, 0) as module_views,
          coalesce(mb.restaurant_count, 0) as restaurant_count,
          tm.top_module,
          case
            when greatest(lb.last_login, mb.last_module) is null then null
            else to_char(
              greatest(lb.last_login, mb.last_module) at time zone 'UTC',
              'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            )
          end as last_at
        from user_ids ids
        left join public.profiles p on p.id = ids.profile_id
        left join auth.users u on u.id = ids.profile_id
        left join login_by_user lb on lb.profile_id = ids.profile_id
        left join module_by_user mb on mb.profile_id = ids.profile_id
        left join top_module_user tm on tm.profile_id = ids.profile_id
        order by coalesce(mb.module_views, 0) desc, coalesce(lb.logins, 0) desc, 2
        limit 500
      ) t
    ), '[]'::jsonb),
    'restaurants', coalesce((
      select jsonb_agg(jsonb_build_object(
        'restaurantId', t.id,
        'name', t.name,
        'users', t.users,
        'moduleViews', t.module_views,
        'logins', t.logins,
        'topModule', t.top_module,
        'lastAt', t.last_at
      ) order by t.module_views desc, t.logins desc, t.name)
      from (
        select
          r.id,
          r.name,
          coalesce(mb.users, 0) as users,
          coalesce(mb.module_views, 0) as module_views,
          coalesce(el.logins, 0) as logins,
          tm.top_module,
          case
            when mb.last_at is null then null
            else to_char(mb.last_at at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')
          end as last_at
        from restaurant_ids ids
        join public.restaurants r on r.id = ids.id
        left join module_by_restaurant mb on mb.restaurant_id = r.id
        left join employee_logins el on el.restaurant_id = r.id
        left join top_module_restaurant tm on tm.restaurant_id = r.id
        order by coalesce(mb.module_views, 0) desc, coalesce(el.logins, 0) desc, r.name
        limit 500
      ) t
    ), '[]'::jsonb),
    'facets', jsonb_build_object(
      'modules', coalesce((
        select jsonb_agg(distinct module_id)
        from in_range
        where kind = 'module_view' and module_id is not null
      ), '[]'::jsonb),
      'restaurants', coalesce((
        select jsonb_agg(jsonb_build_object('id', r.id, 'name', r.name) order by r.name)
        from public.restaurants r
        where r.id in (
          select restaurant_id
          from in_range
          where restaurant_id is not null
          union
          select emp.restaurant_id
          from in_range l
          join public.restaurant_employees emp
            on emp.profile_id = l.profile_id
           and emp.is_active
          where l.kind = 'login'
        )
      ), '[]'::jsonb)
    )
  ) into result;

  return result;
end;
$$;

revoke all on function public.platform_product_usage(timestamptz, timestamptz, text, uuid)
  from public, anon, authenticated;
grant execute on function public.platform_product_usage(timestamptz, timestamptz, text, uuid)
  to service_role;
