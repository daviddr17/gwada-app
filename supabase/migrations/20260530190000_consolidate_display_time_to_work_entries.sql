-- Eine Quelle: Display-Zeiterfassung nur noch über restaurant_staff_work_entries (shift_id + is_open).

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurant_staff_work_entries'
      and column_name = 'time_session_id'
  ) then
    alter table public.restaurant_staff_work_entries
      drop constraint if exists restaurant_staff_work_entries_time_session_id_fkey;

    drop index if exists public.restaurant_staff_work_entries_one_open_per_session_idx;
    drop index if exists public.restaurant_staff_work_entries_time_session_idx;

    alter table public.restaurant_staff_work_entries
      rename column time_session_id to shift_id;
  end if;
end $$;

create index if not exists restaurant_staff_work_entries_shift_idx
  on public.restaurant_staff_work_entries (shift_id)
  where shift_id is not null;

create unique index if not exists restaurant_staff_work_entries_one_open_display_per_staff_idx
  on public.restaurant_staff_work_entries (staff_id)
  where is_open = true and shift_id is not null;

comment on column public.restaurant_staff_work_entries.shift_id is
  'Gruppiert Display-Segmente einer Schicht (Arbeit/Pause). Kein FK — nur logische Schicht-ID.';

drop table if exists public.restaurant_staff_time_sessions;

drop type if exists public.staff_presence_status;
