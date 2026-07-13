-- TripAdvisor (Terra API): Plattform-API-Key + Restaurant location_id — Bewertungen & Galerie-Fotos.

insert into public.platform_integrations (key, enabled, config)
values ('tripadvisor', false, '{}'::jsonb)
on conflict (key) do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'integrations.tripadvisor'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

-- Bewertungs-Cache
alter table public.restaurant_reviews_platform_sync
  drop constraint if exists restaurant_reviews_platform_sync_platform_check;

alter table public.restaurant_reviews_platform_sync
  add constraint restaurant_reviews_platform_sync_platform_check
  check (platform in ('google', 'facebook', 'tripadvisor'));

alter table public.restaurant_reviews_platform_cache
  drop constraint if exists restaurant_reviews_platform_cache_platform_check;

alter table public.restaurant_reviews_platform_cache
  add constraint restaurant_reviews_platform_cache_platform_check
  check (platform in ('google', 'facebook', 'tripadvisor'));

-- Galerie-Cache
alter table public.restaurant_gallery_platform_sync
  drop constraint if exists restaurant_gallery_platform_sync_platform_check;

alter table public.restaurant_gallery_platform_sync
  add constraint restaurant_gallery_platform_sync_platform_check
  check (platform in ('facebook', 'instagram', 'google_business', 'tripadvisor'));

alter table public.restaurant_gallery_platform_cache
  drop constraint if exists restaurant_gallery_platform_cache_platform_check;

alter table public.restaurant_gallery_platform_cache
  add constraint restaurant_gallery_platform_cache_platform_check
  check (platform in ('facebook', 'instagram', 'google_business', 'tripadvisor'));

-- Review-Sichtbarkeit / Auto-Reply
alter table public.restaurant_review_auto_reply_rules
  drop constraint if exists restaurant_review_auto_reply_rules_platform_check;

alter table public.restaurant_review_auto_reply_rules
  add constraint restaurant_review_auto_reply_rules_platform_check
  check (platform in ('gwada', 'google', 'facebook', 'tripadvisor'));

alter table public.restaurant_review_visibility
  drop constraint if exists restaurant_review_visibility_platform_check;

alter table public.restaurant_review_visibility
  add constraint restaurant_review_visibility_platform_check
  check (platform in ('gwada', 'google', 'facebook', 'tripadvisor'));

alter table public.restaurant_review_auto_reply_log
  drop constraint if exists restaurant_review_auto_reply_log_platform_check;

alter table public.restaurant_review_auto_reply_log
  add constraint restaurant_review_auto_reply_log_platform_check
  check (platform in ('gwada', 'google', 'facebook', 'tripadvisor'));

alter table public.restaurant_review_reads
  drop constraint if exists restaurant_review_reads_platform_check;

alter table public.restaurant_review_reads
  add constraint restaurant_review_reads_platform_check
  check (platform in ('gwada', 'google', 'facebook', 'tripadvisor'));

drop function if exists public.platform_messaging_flags();

create or replace function public.platform_messaging_flags()
returns table (
  whatsapp_enabled boolean,
  email_enabled boolean,
  facebook_enabled boolean,
  instagram_enabled boolean,
  google_business_enabled boolean,
  lexoffice_enabled boolean,
  tripadvisor_enabled boolean
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
    ),
    coalesce(
      (select p.enabled from public.platform_integrations p where p.key = 'tripadvisor'),
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
      'lexoffice',
      'tripadvisor'
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
      integration_key in (
        'facebook',
        'instagram',
        'google_business',
        'lexoffice',
        'tripadvisor'
      )
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
    or (
      integration_key = 'tripadvisor'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.tripadvisor')
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
    or (
      integration_key = 'tripadvisor'
      and public.auth_has_restaurant_permission(restaurant_id, 'integrations.tripadvisor')
    )
  );

create or replace function public.restaurant_tripadvisor_integration_ui(p_restaurant_id uuid)
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
  if not public.auth_has_restaurant_permission(p_restaurant_id, 'integrations.tripadvisor') then
    raise exception 'not authorized' using errcode = '42501';
  end if;

  return query
  select
    ri.restaurant_id,
    ri.integration_key,
    ri.status,
    ri.config as config,
    ri.display_name,
    ri.connected_at,
    ri.last_error,
    ri.updated_at
  from public.restaurant_integrations ri
  where ri.restaurant_id = p_restaurant_id
    and ri.integration_key = 'tripadvisor';
end;
$$;

revoke all on function public.restaurant_tripadvisor_integration_ui(uuid) from public;
grant execute on function public.restaurant_tripadvisor_integration_ui(uuid) to authenticated;

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
    'integrations.tripadvisor',
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
    'display.module_switch',
    'pos.kasse.manage',
    'pos.kasse.export',
    'accounting.manage',
    'news.manage',
    'gallery.read',
    'gallery.create',
    'gallery.update',
    'gallery.delete'
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
