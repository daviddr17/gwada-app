-- Detail: die eine Checkliste + Permission-RPC für Owner-Staff

select
  t.id,
  t.title,
  t.assignee_type,
  t.staff_id,
  t.position_tag_id,
  t.show_on_display,
  t.show_on_pin_login,
  t.show_before_clock_in,
  t.show_before_clock_out,
  t.recurrence,
  t.capture_type,
  t.checklist_device_id,
  t.checklist_area_id,
  t.require_corrective_on_deviation,
  t.archived_at,
  t.updated_at
from public.restaurant_staff_todos t
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and t.archived_at is null;

select 'staff_assignees' as kind, a.*
from public.restaurant_staff_todo_staff_assignees a
join public.restaurant_staff_todos t on t.id = a.todo_id
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1);

select 'position_assignees' as kind, a.*
from public.restaurant_staff_todo_position_assignees a
join public.restaurant_staff_todos t on t.id = a.todo_id
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1);

-- Owner staff position_tag + permissions
select
  rs.id,
  rs.position_tag_id,
  rs.restaurant_position_id,
  rp.slug as position_slug,
  public.staff_display_permission_keys(rs.id) as perm_keys
from public.restaurant_staff rs
left join public.restaurant_positions rp on rp.id = rs.restaurant_position_id
where rs.id = '02be2c34-9973-4057-bfe4-96237aa5ca58';

-- Open display + auto_lock
select
  d.id as display_id,
  d.name,
  d.auto_lock_seconds,
  d.allowed_modules,
  s.id as session_id,
  s.staff_id,
  s.last_activity_at,
  s.ended_at,
  extract(epoch from (timezone('utc', now()) - s.last_activity_at))::int as idle_seconds
from public.restaurant_displays d
left join public.restaurant_display_sessions s
  on s.display_id = d.id and s.ended_at is null
where d.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1);

-- Simulate problematic embed shape (count)
select count(*) as todo_embed_ok
from public.restaurant_staff_todos t
left join public.restaurant_checklist_devices d on d.id = t.checklist_device_id
left join public.restaurant_checklist_areas a on a.id = t.checklist_area_id
where t.restaurant_id = (select id from public.restaurants where slug = 'zurschlagd' limit 1)
  and t.archived_at is null;
