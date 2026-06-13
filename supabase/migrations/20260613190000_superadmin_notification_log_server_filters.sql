-- Superadmin Notification-Log: serverseitige Filter, Suche und total_count pro Seite.

drop function if exists public.superadmin_list_notification_log(integer, integer);

create or replace function public.superadmin_list_notification_log(
  p_limit integer default 50,
  p_offset integer default 0,
  p_search text default null,
  p_module text default null,
  p_channel text default null,
  p_status text default null
)
returns table (
  row_kind text,
  delivery_id uuid,
  event_id uuid,
  event_created_at timestamptz,
  event_processed_at timestamptz,
  restaurant_id uuid,
  restaurant_name text,
  context_restaurant_id uuid,
  context_restaurant_name text,
  module text,
  reference_id text,
  payload jsonb,
  profile_id uuid,
  recipient_email text,
  recipient_name text,
  channel text,
  delivery_status text,
  delivery_attempts integer,
  last_error text,
  scheduled_at timestamptz,
  sent_at timestamptz,
  delivery_created_at timestamptz,
  idempotency_key text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_search text := nullif(trim(coalesce(p_search, '')), '');
  v_module text := nullif(trim(coalesce(p_module, '')), '');
  v_channel text := nullif(trim(coalesce(p_channel, '')), '');
  v_status text := nullif(trim(coalesce(p_status, '')), '');
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if v_module = 'all' then
    v_module := null;
  end if;
  if v_channel = 'all' then
    v_channel := null;
  end if;
  if v_status = 'all' then
    v_status := null;
  end if;

  return query
  with base as (
    select
      'delivery'::text as row_kind,
      d.id as delivery_id,
      e.id as event_id,
      e.created_at as event_created_at,
      e.processed_at as event_processed_at,
      e.restaurant_id,
      er.name as restaurant_name,
      d.context_restaurant_id,
      cr.name as context_restaurant_name,
      e.module,
      e.reference_id,
      e.payload,
      d.profile_id,
      u.email::text as recipient_email,
      nullif(
        trim(concat_ws(' ', p.given_name, p.family_name, p.display_name)),
        ''
      ) as recipient_name,
      d.channel,
      d.status as delivery_status,
      d.attempts as delivery_attempts,
      d.last_error,
      d.scheduled_at,
      d.sent_at,
      d.created_at as delivery_created_at,
      d.idempotency_key,
      coalesce(d.sent_at, d.created_at, e.created_at) as sort_at
    from public.notification_deliveries d
    inner join public.notification_events e on e.id = d.event_id
    left join public.restaurants er on er.id = e.restaurant_id
    left join public.restaurants cr on cr.id = d.context_restaurant_id
    left join public.profiles p on p.id = d.profile_id
    left join auth.users u on u.id = d.profile_id

    union all

    select
      'event_only'::text as row_kind,
      null::uuid as delivery_id,
      e.id as event_id,
      e.created_at as event_created_at,
      e.processed_at as event_processed_at,
      e.restaurant_id,
      er.name as restaurant_name,
      e.restaurant_id as context_restaurant_id,
      er.name as context_restaurant_name,
      e.module,
      e.reference_id,
      e.payload,
      null::uuid as profile_id,
      null::text as recipient_email,
      null::text as recipient_name,
      null::text as channel,
      null::text as delivery_status,
      null::integer as delivery_attempts,
      case
        when e.processed_at is null then 'event_pending'
        else 'no_delivery'
      end as last_error,
      null::timestamptz as scheduled_at,
      null::timestamptz as sent_at,
      null::timestamptz as delivery_created_at,
      null::text as idempotency_key,
      e.created_at as sort_at
    from public.notification_events e
    left join public.restaurants er on er.id = e.restaurant_id
    where not exists (
      select 1
      from public.notification_deliveries d
      where d.event_id = e.id
    )
  ),
  filtered as (
    select b.*
    from base b
    where
      (v_module is null or b.module = v_module)
      and (
        v_channel is null
        or (v_channel = 'none' and b.row_kind = 'event_only')
        or (v_channel in ('whatsapp', 'email') and b.channel = v_channel)
      )
      and (
        v_status is null
        or (v_status = 'event_only' and b.row_kind = 'event_only')
        or (
          b.row_kind = 'delivery'
          and b.delivery_status = v_status
        )
      )
      and (
        v_search is null
        or b.reference_id ilike '%' || v_search || '%'
        or coalesce(b.restaurant_name, '') ilike '%' || v_search || '%'
        or coalesce(b.context_restaurant_name, '') ilike '%' || v_search || '%'
        or coalesce(b.recipient_email, '') ilike '%' || v_search || '%'
        or coalesce(b.recipient_name, '') ilike '%' || v_search || '%'
        or coalesce(b.last_error, '') ilike '%' || v_search || '%'
        or b.module ilike '%' || v_search || '%'
        or b.payload::text ilike '%' || v_search || '%'
        or b.profile_id::text ilike '%' || v_search || '%'
        or b.event_id::text ilike '%' || v_search || '%'
        or b.delivery_id::text ilike '%' || v_search || '%'
        or coalesce(b.idempotency_key, '') ilike '%' || v_search || '%'
      )
  )
  select
    f.row_kind,
    f.delivery_id,
    f.event_id,
    f.event_created_at,
    f.event_processed_at,
    f.restaurant_id,
    f.restaurant_name,
    f.context_restaurant_id,
    f.context_restaurant_name,
    f.module,
    f.reference_id,
    f.payload,
    f.profile_id,
    f.recipient_email,
    f.recipient_name,
    f.channel,
    f.delivery_status,
    f.delivery_attempts,
    f.last_error,
    f.scheduled_at,
    f.sent_at,
    f.delivery_created_at,
    f.idempotency_key,
    count(*) over () as total_count
  from filtered f
  order by f.sort_at desc nulls last, f.event_created_at desc
  limit greatest(1, least(coalesce(p_limit, 50), 100))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.superadmin_list_notification_log(integer, integer, text, text, text, text) is
  'Superadmin: gefiltertes Notification-Log mit total_count (Paginierung + Suche serverseitig).';

revoke all on function public.superadmin_list_notification_log(integer, integer, text, text, text, text) from public;
grant execute on function public.superadmin_list_notification_log(integer, integer, text, text, text, text) to authenticated;

create index if not exists notification_deliveries_created_at_desc_idx
  on public.notification_deliveries (created_at desc);

create index if not exists notification_events_created_at_desc_idx
  on public.notification_events (created_at desc);
