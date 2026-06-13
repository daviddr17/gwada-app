-- Superadmin: plattformweites Notification-Log (Events + Deliveries) für Ops/Debug.

create or replace function public.superadmin_list_notification_log(
  p_limit integer default 200,
  p_offset integer default 0
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
  idempotency_key text
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
begin
  if not public.auth_is_superadmin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    combined.row_kind,
    combined.delivery_id,
    combined.event_id,
    combined.event_created_at,
    combined.event_processed_at,
    combined.restaurant_id,
    combined.restaurant_name,
    combined.context_restaurant_id,
    combined.context_restaurant_name,
    combined.module,
    combined.reference_id,
    combined.payload,
    combined.profile_id,
    combined.recipient_email,
    combined.recipient_name,
    combined.channel,
    combined.delivery_status,
    combined.delivery_attempts,
    combined.last_error,
    combined.scheduled_at,
    combined.sent_at,
    combined.delivery_created_at,
    combined.idempotency_key
  from (
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
      d.idempotency_key
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
      null::text as idempotency_key
    from public.notification_events e
    left join public.restaurants er on er.id = e.restaurant_id
    where not exists (
      select 1
      from public.notification_deliveries d
      where d.event_id = e.id
    )
  ) combined
  order by
    coalesce(combined.sent_at, combined.delivery_created_at, combined.event_created_at) desc nulls last,
    combined.event_created_at desc
  limit greatest(1, least(coalesce(p_limit, 200), 500))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.superadmin_list_notification_log(integer, integer) is
  'Superadmin: Events und Push-Deliveries (WhatsApp/E-Mail) für Ops/Debug — neueste zuerst.';

revoke all on function public.superadmin_list_notification_log(integer, integer) from public;
grant execute on function public.superadmin_list_notification_log(integer, integer) to authenticated;
