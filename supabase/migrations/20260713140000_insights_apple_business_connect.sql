-- Insights-Modul Berechtigungen + Apple Business Connect Plattform

insert into public.platform_integrations (key, enabled, config)
values ('apple_business_connect', false, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.apple_business_connect'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_key_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_key_check
  check (
    integration_key in (
      'whatsapp',
      'email',
      'facebook',
      'instagram',
      'google_business',
      'lexoffice',
      'tripadvisor',
      'apple_business_connect'
    )
  );

drop function if exists public.platform_messaging_flags();

create or replace function public.platform_messaging_flags()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'whatsapp_enabled', coalesce((select enabled from public.platform_integrations where key = 'whatsapp'), false),
    'email_enabled', coalesce((select enabled from public.platform_integrations where key = 'email'), false),
    'facebook_enabled', coalesce((select enabled from public.platform_integrations where key = 'facebook'), false),
    'instagram_enabled', coalesce((select enabled from public.platform_integrations where key = 'instagram'), false),
    'google_business_enabled', coalesce((select enabled from public.platform_integrations where key = 'google_business'), false),
    'lexoffice_enabled', coalesce((select enabled from public.platform_integrations where key = 'lexoffice'), false),
    'tripadvisor_enabled', coalesce((select enabled from public.platform_integrations where key = 'tripadvisor'), false),
    'apple_business_connect_enabled', coalesce((select enabled from public.platform_integrations where key = 'apple_business_connect'), false)
  );
$$;

revoke all on function public.platform_messaging_flags() from public;
grant execute on function public.platform_messaging_flags() to authenticated;

-- Insights: Lesen für Inhaber-Positionen (analog reviews)
insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm.key
from public.restaurant_positions rp
cross join (
  values
    ('insights.read'),
    ('insights.create'),
    ('insights.update'),
    ('insights.delete')
) as perm(key)
where rp.slug = 'owner'
on conflict do nothing;

-- auth_has_restaurant_permission: insights-Prefix
create or replace function public.auth_has_restaurant_permission(
  p_restaurant_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_prefix text;
  v_suffix text;
  v_module_prefixes text[] := array[
    'menu', 'inventory', 'reservations', 'contacts', 'news', 'events',
    'reviews', 'documents', 'staff', 'accounting', 'insights'
  ];
begin
  if p_permission is null or p_permission = '' then
    return false;
  end if;

  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  ) then
    return true;
  end if;

  if exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and rpp.permission_key = p_permission
  ) then
    return true;
  end if;

  v_prefix := split_part(p_permission, '.', 1);
  v_suffix := split_part(p_permission, '.', 2);

  if not (v_prefix = any (v_module_prefixes)) then
    return false;
  end if;

  if v_suffix = 'manage' then
    return exists (
      select 1
      from public.restaurant_employees re
      inner join public.restaurant_position_permissions rpp
        on rpp.position_id = re.position_id
      where re.restaurant_id = p_restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.position_id is not null
        and (
          rpp.permission_key = p_permission
          or rpp.permission_key in (
            v_prefix || '.read',
            v_prefix || '.create',
            v_prefix || '.update',
            v_prefix || '.delete'
          )
        )
    );
  end if;

  if v_suffix = 'read' then
    return exists (
      select 1
      from public.restaurant_employees re
      inner join public.restaurant_position_permissions rpp
        on rpp.position_id = re.position_id
      where re.restaurant_id = p_restaurant_id
        and re.profile_id = (select auth.uid())
        and re.is_active
        and re.position_id is not null
        and (
          rpp.permission_key = p_permission
          or rpp.permission_key = v_prefix || '.manage'
          or rpp.permission_key in (
            v_prefix || '.create',
            v_prefix || '.update',
            v_prefix || '.delete'
          )
        )
    );
  end if;

  return exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_position_permissions rpp
      on rpp.position_id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and re.position_id is not null
      and (
        rpp.permission_key = p_permission
        or rpp.permission_key = v_prefix || '.manage'
      )
  );
end;
$$;
