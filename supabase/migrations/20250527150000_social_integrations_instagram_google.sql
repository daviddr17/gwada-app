-- Instagram & Google Business Profile: Plattform + Restaurant + Berechtigungen.

insert into public.platform_integrations (key, enabled, config)
values ('google_business', false, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, perm
from public.restaurant_positions rp
cross join (
  values
    ('integrations.instagram'),
    ('integrations.google_business')
) as t(perm)
where rp.slug in ('owner', 'manager')
on conflict do nothing;

drop function if exists public.platform_messaging_flags();

create or replace function public.platform_messaging_flags()
returns table (
  whatsapp_enabled boolean,
  email_enabled boolean,
  facebook_enabled boolean,
  instagram_enabled boolean,
  google_business_enabled boolean
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
      'google_business'
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
      integration_key in ('facebook', 'instagram', 'google_business')
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
  );

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
    'settings.restaurant',
    'settings.opening_hours',
    'settings.branding',
    'settings.dashboard'
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
