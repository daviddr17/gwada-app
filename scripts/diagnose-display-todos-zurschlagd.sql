-- Diagnose display todos for zurschlagd
\set ON_ERROR_STOP on

select id, slug, name from public.restaurants where slug = 'zurschlagd';

select 'open_sessions' as kind, s.id, s.staff_id, st.given_name, st.family_name, s.ended_at is null as open, s.last_activity_at
from public.restaurant_display_sessions s
left join public.restaurant_staff st on st.id = s.staff_id
where s.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and s.ended_at is null
order by s.last_activity_at desc
limit 20;

select 'orphan_session_staff' as kind, s.id, s.staff_id
from public.restaurant_display_sessions s
left join public.restaurant_staff st on st.id = s.staff_id
where s.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and s.ended_at is null
  and st.id is null;

select 'todo_cols' as kind, column_name, data_type
from information_schema.columns
where table_schema = 'public' and table_name = 'restaurant_staff_todos'
  and column_name in (
    'checklist_device_id','checklist_area_id','require_corrective_on_deviation',
    'capture_type','show_on_display','show_on_pin_login'
  )
order by column_name;

select 'device_cols' as kind, column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'restaurant_checklist_devices'
order by ordinal_position;

select 'area_cols' as kind, column_name
from information_schema.columns
where table_schema = 'public' and table_name = 'restaurant_checklist_areas'
order by ordinal_position;

select 'todos_bad_device_fk' as kind, t.id, t.title, t.checklist_device_id
from public.restaurant_staff_todos t
left join public.restaurant_checklist_devices d on d.id = t.checklist_device_id
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and t.checklist_device_id is not null
  and d.id is null
  and t.archived_at is null;

select 'todos_bad_area_fk' as kind, t.id, t.title, t.checklist_area_id
from public.restaurant_staff_todos t
left join public.restaurant_checklist_areas a on a.id = t.checklist_area_id
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and t.checklist_area_id is not null
  and a.id is null
  and t.archived_at is null;

select 'david_staff' as kind, rs.id, rs.given_name, rs.family_name, rs.is_active, rp.slug
from public.restaurant_staff rs
left join public.restaurant_positions rp on rp.id = rs.restaurant_position_id
where rs.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and rs.family_name ilike 'Dreyer' and rs.given_name ilike 'David';

select 'assignees_missing_staff' as kind, a.todo_id, a.staff_id
from public.restaurant_staff_todo_staff_assignees a
join public.restaurant_staff_todos t on t.id = a.todo_id
left join public.restaurant_staff s on s.id = a.staff_id
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and s.id is null;

select 'todo_count' as kind, count(*)::int as n
from public.restaurant_staff_todos
where restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and archived_at is null;
