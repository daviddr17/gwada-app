-- Diagnose: zurschlagd WhatsApp integration + session for reservation dispatch
select
  r.id as restaurant_id,
  r.slug,
  r.name,
  ri.status,
  ri.phone_number,
  ri.display_name,
  ri.waha_session_name,
  ri.waha_server_id,
  ri.last_error,
  ri.connected_at,
  ri.updated_at
from public.restaurants r
left join public.restaurant_integrations ri
  on ri.restaurant_id = r.id
 and ri.integration_key = 'whatsapp'
where r.slug = 'zurschlagd';

select
  id,
  name,
  enabled,
  accept_new_sessions,
  base_url,
  docker_container_name,
  nullif(btrim(api_key), '') is not null as has_api_key,
  sort_order
from public.waha_servers
order by sort_order, name;

\echo === due / failed whatsapp outbox (last 14d) ===
select
  o.message_kind,
  o.send_at,
  o.sent_at,
  o.cancelled_at,
  o.claimed_at,
  o.attempt_count,
  left(coalesce(o.waha_message_id, ''), 24) as waha_id,
  left(coalesce(o.last_error, ''), 80) as last_error,
  o.reservation_id
from public.reservation_whatsapp_outbox o
join public.restaurants r on r.id = o.restaurant_id
where r.slug = 'zurschlagd'
  and o.send_at > now() - interval '14 days'
  and (
    o.sent_at is null
    or o.last_error is not null
    or o.cancelled_at is not null
  )
order by o.send_at desc
limit 40;

\echo === outbox error counts (14d) ===
select
  o.message_kind,
  coalesce(nullif(left(o.last_error, 60), ''), '(none)') as err,
  count(*) as n
from public.reservation_whatsapp_outbox o
join public.restaurants r on r.id = o.restaurant_id
where r.slug = 'zurschlagd'
  and o.send_at > now() - interval '14 days'
group by 1, 2
order by n desc
limit 30;
