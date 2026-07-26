-- E-Mail-Integration: Status „gmail“ (OAuth) + Token-Redaktion in der UI-RPC.

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_status_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_status_check
  check (
    (
      integration_key = 'whatsapp'
      and status in (
        'disconnected',
        'starting',
        'scan_qr',
        'working',
        'failed',
        'stopped'
      )
    )
    or (
      integration_key = 'email'
      and status in ('default', 'custom', 'gmail')
    )
    or (
      integration_key in (
        'facebook',
        'instagram',
        'google_business',
        'lexoffice',
        'tripadvisor',
        'apple_business_connect'
      )
      and status in ('disconnected', 'working')
    )
  );

create or replace function public.restaurant_email_integration_ui(p_restaurant_id uuid)
returns table (
  restaurant_id uuid,
  integration_key text,
  status text,
  config jsonb,
  last_error text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.auth_has_restaurant_permission(p_restaurant_id, 'integrations.email') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    ri.restaurant_id,
    ri.integration_key,
    ri.status,
    ri.config
      - 'password'
      - 'refresh_token'
      - 'access_token' as config,
    ri.last_error,
    ri.updated_at
  from public.restaurant_integrations ri
  where ri.restaurant_id = p_restaurant_id
    and ri.integration_key = 'email';
end;
$$;

revoke all on function public.restaurant_email_integration_ui(uuid) from public;
grant execute on function public.restaurant_email_integration_ui(uuid) to authenticated;
