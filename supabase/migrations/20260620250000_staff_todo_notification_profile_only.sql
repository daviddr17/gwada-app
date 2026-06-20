-- ToDo-Benachrichtigungen: Steuerung nur noch über Profil → Benachrichtigungen (pro Nutzer),
-- nicht mehr über Restaurant-Einstellungen in ToDo-Listen.

create or replace function public.emit_staff_todo_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module text;
  v_title text;
begin
  if new.action in ('completed', 'completed_by_manager') then
    v_module := 'staff_todo_completed';
  elsif new.action = 'deferred' then
    v_module := 'staff_todo_deferred';
  else
    return new;
  end if;

  select coalesce(nullif(trim(t.title), ''), 'ToDo')
  into v_title
  from public.restaurant_staff_todos t
  where t.id = new.todo_id;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    v_module,
    new.id::text,
    jsonb_build_object(
      'logEntryId', new.id,
      'todoId', new.todo_id,
      'todoTitle', v_title,
      'action', new.action,
      'actorUserId', new.actor_user_id,
      'actorStaffId', new.actor_staff_id,
      'details', new.details,
      'createdAt', new.created_at
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = v_module
      and e.reference_id = new.id::text
      and e.restaurant_id = new.restaurant_id
  );

  return new;
end;
$$;
