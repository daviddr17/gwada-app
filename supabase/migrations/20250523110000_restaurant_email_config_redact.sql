-- UI/API: E-Mail-Integration ohne Passwort im Klartext (Versand nur serverseitig).

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
    ri.config - 'password' as config,
    ri.last_error,
    ri.updated_at
  from public.restaurant_integrations ri
  where ri.restaurant_id = p_restaurant_id
    and ri.integration_key = 'email';
end;
$$;

revoke all on function public.restaurant_email_integration_ui(uuid) from public;
grant execute on function public.restaurant_email_integration_ui(uuid) to authenticated;
