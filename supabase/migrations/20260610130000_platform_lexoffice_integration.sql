-- Lexware Office (Lexoffice): Plattform-Feature + Restaurant-API-Key + Berechtigungen.

insert into public.platform_integrations (key, enabled, config)
values ('lexoffice', false, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.lexoffice'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

drop function if exists public.platform_messaging_flags();

create or replace function public.platform_messaging_flags()
returns table (
  whatsapp_enabled boolean,
  email_enabled boolean,
  facebook_enabled boolean,
  instagram_enabled boolean,
  google_business_enabled boolean,
  lexoffice_enabled boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'whatsapp'),
      false
    ),
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'email'),
      false
    ),
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'facebook'),
      false
    ),
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'instagram'),
      false
    ),
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'google_business'),
      false
    ),
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'lexoffice'),
      false
    );
$$;

revoke all on function public.platform_messaging_flags() from public;
grant execute on function public.platform_messaging_flags() to authenticated;

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
      'lexoffice'
    )
  );

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
      and status in ('default', 'custom')
    )
    or (
      integration_key in ('facebook', 'instagram', 'google_business', 'lexoffice')
      and status in ('disconnected', 'working')
    )
  );

drop policy if exists restaurant_integrations_write_per_key on public.restaurant_integrations;

create policy restaurant_integrations_write_per_key
  on public.restaurant_integrations for all
  to authenticated
  using (
    (
      integration_key = 'whatsapp'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.whatsapp')
    )
    or (
      integration_key = 'email'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.email')
    )
    or (
      integration_key = 'facebook'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.facebook')
    )
    or (
      integration_key = 'instagram'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.instagram')
    )
    or (
      integration_key = 'google_business'
      and public.auth_has_restaurant_permission(
        restaurant_id,
        'integrations.google_business'
      )
    )
    or (
      integration_key = 'lexoffice'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.lexoffice')
    )
  )
  with check (
    (
      integration_key = 'whatsapp'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.whatsapp')
    )
    or (
      integration_key = 'email'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.email')
    )
    or (
      integration_key = 'facebook'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.facebook')
    )
    or (
      integration_key = 'instagram'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.instagram')
    )
    or (
      integration_key = 'google_business'
      and public.auth_has_restaurant_permission(
        restaurant_id,
        'integrations.google_business'
      )
    )
    or (
      integration_key = 'lexoffice'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.lexoffice')
    )
  );

create or replace function public.restaurant_lexoffice_integration_ui(p_restaurant_id uuid)
returns table (
  restaurant_id uuid,
  integration_key text,
  status text,
  config jsonb,
  display_name text,
  connected_at timestamptz,
  last_error text,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.auth_has_restaurant_permission(p_restaurant_id, 'integrations.lexoffice') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    ri.restaurant_id,
    ri.integration_key,
    ri.status,
    (ri.config - 'api_key')
      || jsonb_build_object(
        'api_key_configured',
        coalesce(nullif(trim(ri.config ->> 'api_key'), ''), '') <> ''
      ) as config,
    ri.display_name,
    ri.connected_at,
    ri.last_error,
    ri.updated_at
  from public.restaurant_integrations ri
  where ri.restaurant_id = p_restaurant_id
    and ri.integration_key = 'lexoffice';
end;
$$;

revoke all on function public.restaurant_lexoffice_integration_ui(uuid) from public;
grant execute on function public.restaurant_lexoffice_integration_ui(uuid) to authenticated;

create or replace function public.auth_user_restaurant_permission_keys(p_restaurant_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct rpp.permission_key
  from public.restaurant_employees re
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = re.position_id
  where re.restaurant_id = p_restaurant_id
    and re.profile_id = (select auth.uid())
    and re.is_active
    and re.position_id is not null
  union
  select unnest(array[
    'roles.manage',
    'team.manage',
    'integrations.whatsapp',
    'integrations.email',
    'integrations.facebook',
    'integrations.instagram',
    'integrations.google_business',
    'integrations.lexoffice',
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard',
    'documents.notes.edit',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.inventory',
    'display.kds',
    'display.module_switch'
  ]::text[])
  where exists (
    select 1
    from public.restaurant_employees re
    inner join public.restaurant_positions rp on rp.id = re.position_id
    where re.restaurant_id = p_restaurant_id
      and re.profile_id = (select auth.uid())
      and re.is_active
      and rp.slug = 'owner'
  );
$$;
