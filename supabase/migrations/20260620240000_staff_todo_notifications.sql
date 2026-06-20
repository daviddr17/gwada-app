-- ToDo-Listen: Benachrichtigungen (Glocke + Push)

alter table public.notification_events
  drop constraint if exists notification_events_module_check;

alter table public.notification_events
  add constraint notification_events_module_check
  check (
    module in (
      'messages',
      'reviews',
      'changelog',
      'reservations_pending',
      'reservations_change_request',
      'reservations_cancellation',
      'staff_shift_start',
      'staff_shift_end',
      'inventory_low_stock',
      'accounting_quotation',
      'accounting_invoice',
      'accounting_voucher',
      'staff_todo_completed',
      'staff_todo_deferred'
    )
  );

create table if not exists public.restaurant_staff_todo_notification_dismissals (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  log_entry_id uuid not null references public.restaurant_staff_todo_log_entries (id) on delete cascade,
  module text not null check (
    module in ('staff_todo_completed', 'staff_todo_deferred')
  ),
  dismissed_at timestamptz not null default timezone('utc', now()),
  primary key (profile_id, restaurant_id, log_entry_id, module)
);

create index if not exists restaurant_staff_todo_notification_dismissals_restaurant_idx
  on public.restaurant_staff_todo_notification_dismissals (restaurant_id, profile_id);

alter table public.restaurant_staff_todo_notification_dismissals enable row level security;

create policy restaurant_staff_todo_notification_dismissals_rw_own_staff
  on public.restaurant_staff_todo_notification_dismissals for all
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

create or replace function public.emit_staff_todo_notification_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_module text;
  v_title text;
  v_notify boolean;
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

  select case
    when v_module = 'staff_todo_completed' then s.notify_on_completed
    else s.notify_on_deferred
  end
  into v_notify
  from public.restaurant_staff_todo_settings s
  where s.restaurant_id = new.restaurant_id;

  if v_notify is null then
    v_notify := true;
  end if;

  if not v_notify then
    return new;
  end if;

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

drop trigger if exists restaurant_staff_todo_log_emit_notification
  on public.restaurant_staff_todo_log_entries;

create trigger restaurant_staff_todo_log_emit_notification
  after insert on public.restaurant_staff_todo_log_entries
  for each row execute function public.emit_staff_todo_notification_event();
