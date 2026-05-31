-- Superadmin-UI: Integrationen ohne Secrets im Klartext.

create or replace function public.platform_integrations_superadmin_list()
returns table (
  key text,
  enabled boolean,
  config jsonb,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.key,
    p.enabled,
    case p.key
      when 'whatsapp' then p.config - 'waha_api_key'
      when 'email' then p.config - 'password'
      else p.config - 'client_secret'
    end as config,
    p.updated_at
  from public.platform_integrations p
  where public.auth_is_superadmin();
$$;

revoke all on function public.platform_integrations_superadmin_list() from public;
grant execute on function public.platform_integrations_superadmin_list() to authenticated;
