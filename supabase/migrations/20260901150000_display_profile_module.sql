-- Display-Modul: documents → profile (Stammdaten + Dokumente-Chips)

do $$ begin
  alter type public.display_module add value if not exists 'profile';
exception
  when duplicate_object then null;
end $$;

update public.restaurant_displays rd
set allowed_modules = coalesce(
  (
    select array_agg(
      case
        when m::text = 'documents' then 'profile'::public.display_module
        else m
      end
      order by ord
    )
    from unnest(rd.allowed_modules) with ordinality as t(m, ord)
  ),
  '{}'::public.display_module[]
)
where exists (
  select 1
  from unnest(rd.allowed_modules) as m
  where m::text = 'documents'
);

insert into public.restaurant_position_permissions (position_id, permission_key)
select rp.id, 'display.profile'
from public.restaurant_positions rp
where rp.slug in ('owner', 'manager')
on conflict do nothing;

insert into public.restaurant_position_permissions (position_id, permission_key)
select rpp.position_id, 'display.profile'
from public.restaurant_position_permissions rpp
where rpp.permission_key = 'display.documents'
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
    'display.inventory',
    'display.compliance',
    'display.profile',
    'display.kds',
    'display.module_switch'
  ]::text[])
  from resolved r
  inner join public.restaurant_positions rp on rp.id = r.position_id
  where rp.slug = 'owner';
$$;
