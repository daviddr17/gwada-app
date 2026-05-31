-- Display-Zeiterfassung → Arbeitszeiten-Einträge (Dashboard)

alter table public.restaurant_staff_work_entries
  drop constraint if exists restaurant_staff_work_entries_range;

alter table public.restaurant_staff_work_entries
  add constraint restaurant_staff_work_entries_range check (ends_at >= starts_at);

do $$
begin
  if to_regclass('public.restaurant_staff_time_sessions') is not null
    and not exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'restaurant_staff_work_entries'
        and column_name in ('time_session_id', 'shift_id')
    )
  then
    alter table public.restaurant_staff_work_entries
      add column time_session_id uuid references public.restaurant_staff_time_sessions (id) on delete cascade;

    alter table public.restaurant_staff_work_entries
      add column is_open boolean not null default false;

    create index restaurant_staff_work_entries_time_session_idx
      on public.restaurant_staff_work_entries (time_session_id)
      where time_session_id is not null;

    create unique index restaurant_staff_work_entries_one_open_per_session_idx
      on public.restaurant_staff_work_entries (time_session_id)
      where is_open = true and time_session_id is not null;
  elsif not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'restaurant_staff_work_entries'
      and column_name = 'is_open'
  ) then
    alter table public.restaurant_staff_work_entries
      add column is_open boolean not null default false;
  end if;
end $$;

comment on column public.restaurant_staff_work_entries.is_open is
  'Laufender Segment-Eintrag aus Display (ends_at wird beim Abschluss gesetzt).';
