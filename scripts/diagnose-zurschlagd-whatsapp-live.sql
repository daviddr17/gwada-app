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
