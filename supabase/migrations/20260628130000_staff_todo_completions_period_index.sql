-- Schnellere Perioden-Abfragen: Completions pro ToDo + Mitarbeiter im Lookback-Fenster
create index if not exists restaurant_staff_todo_completions_todo_staff_completed_idx
  on public.restaurant_staff_todo_completions (todo_id, staff_id, completed_at desc)
  where reopened_at is null and completed_at is not null;
