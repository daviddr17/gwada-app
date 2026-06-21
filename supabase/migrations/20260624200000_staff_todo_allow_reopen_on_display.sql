-- ToDo: Erledigung am Display wieder rückgängig machen (pro ToDo)

alter table public.restaurant_staff_todos
  add column if not exists allow_reopen_on_display boolean not null default false;

comment on column public.restaurant_staff_todos.allow_reopen_on_display is
  'Am Display darf der Mitarbeiter die Erledigung per Switch wieder zurücknehmen.';
