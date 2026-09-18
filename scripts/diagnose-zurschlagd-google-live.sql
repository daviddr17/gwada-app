-- Read-only: Google-Business-Verbindung Zur Schlagd, ohne Tokens.
select r.id, r.slug, r.name
from public.restaurants r
where r.slug = 'zurschlagd';

select
  ri.status,
  ri.display_name,
  ri.last_error,
  ri.connected_at,
  ri.updated_at,
  ri.config->>'account_name' as account_name,
  ri.config->>'account_title' as account_title,
  ri.config->>'location_name' as location_name,
  ri.config->>'location_title' as location_title,
  (length(coalesce(ri.config->>'access_token', '')) > 0) as has_access_token,
  (length(coalesce(ri.config->>'refresh_token', '')) > 0) as has_refresh_token,
  ri.config->'granted_scopes' as granted_scopes,
  ri.config->>'scopes_checked_at' as scopes_checked_at
from public.restaurant_integrations ri
join public.restaurants r on r.id = ri.restaurant_id
where r.slug = 'zurschlagd'
  and ri.integration_key = 'google_business';

select
  pi.enabled,
  (length(coalesce(pi.config->>'client_id', '')) > 0) as has_client_id,
  (length(coalesce(pi.config->>'client_secret', '')) > 0) as has_client_secret,
  pi.updated_at
from public.platform_integrations pi
where pi.key = 'google_business';
