-- Profil: eigener Push-Verlauf (nur eigene notification_deliveries + abgeleitete Event-Felder).

create or replace function public.user_list_notification_push_history(
  p_context_restaurant_id uuid,
  p_limit integer default 5,
  p_offset integer default 0
)
returns table (
  delivery_id uuid,
  occurred_at timestamptz,
  channel text,
  delivery_status text,
  module text,
  payload jsonb,
  last_error text,
  total_count bigint
)
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  if p_context_restaurant_id is null
    or not public.auth_is_restaurant_staff(p_context_restaurant_id) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
  select
    d.id as delivery_id,
    coalesce(d.sent_at, d.created_at) as occurred_at,
    d.channel,
    d.status as delivery_status,
    e.module,
    e.payload,
    d.last_error,
    count(*) over () as total_count
  from public.notification_deliveries d
  inner join public.notification_events e on e.id = d.event_id
  where d.profile_id = v_uid
    and d.context_restaurant_id = p_context_restaurant_id
    and d.status in ('sent', 'failed')
  order by coalesce(d.sent_at, d.created_at) desc
  limit greatest(1, least(coalesce(p_limit, 5), 200))
  offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

comment on function public.user_list_notification_push_history(uuid, integer, integer) is
  'Profil: Push-Zustellungen des angemeldeten Users für ein Restaurant (sent/failed). Keine fremden Empfängerdaten.';

revoke all on function public.user_list_notification_push_history(uuid, integer, integer) from public;
grant execute on function public.user_list_notification_push_history(uuid, integer, integer) to authenticated;
