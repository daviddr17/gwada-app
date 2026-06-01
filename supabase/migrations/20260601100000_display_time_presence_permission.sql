-- Display: Team-Anwesenheit in Zeiterfassung (wer ist eingestempelt / in Pause)

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'display.time_presence'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

create or replace function public.staff_display_permission_keys(p_staff_id uuid)
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  with resolved as (
    select
      rs.id as staff_id,
      coalesce(re.position_id, rs.restaurant_position_id) as position_id
    from public.restaurant_staff rs
    left join public.restaurant_employees re on re.id = rs.employee_id
    where rs.id = p_staff_id
      and rs.is_active
  )
  select distinct rpp.permission_key
  from resolved r
  inner join public.restaurant_position_permissions rpp
    on rpp.position_id = r.position_id
  where r.position_id is not null
  union
  select unnest(array[
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
    'display.kds',
    'display.module_switch'
  ]::text[])
  from resolved r
  inner join public.restaurant_positions rp on rp.id = r.position_id
  where rp.slug = 'owner';
$$;

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
    'settings.dashboard',
    'documents.notes.edit',
    'display.manage',
    'display.time',
    'display.time_presence',
    'display.reservations',
    'display.recipes',
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
