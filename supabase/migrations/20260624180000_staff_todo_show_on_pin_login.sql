-- ToDo: bei jeder Display-PIN-Anmeldung als Popup anzeigen

alter table public.restaurant_staff_todos
  add column if not exists show_on_pin_login boolean not null default false;

comment on column public.restaurant_staff_todos.show_on_pin_login is
  'Popup bei jeder PIN-Anmeldung am Display (Mitarbeiter oder Position).';

alter table public.restaurant_staff_todo_deferrals
  drop constraint if exists restaurant_staff_todo_deferrals_trigger_check;

alter table public.restaurant_staff_todo_deferrals
  add constraint restaurant_staff_todo_deferrals_trigger_check check (
    trigger_type in (
      'clock_in',
      'break_start',
      'break_end',
      'clock_out',
      'pin_login'
    )
  );
