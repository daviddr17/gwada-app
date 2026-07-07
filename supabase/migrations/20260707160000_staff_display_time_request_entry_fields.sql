-- Display-Nachtragung: Art + Zeitraum (nicht nur Schichtstart)

alter table public.restaurant_staff_display_time_requests
  add column if not exists entry_type text not null default 'work'
    check (entry_type in ('work', 'break', 'sick', 'vacation'));

alter table public.restaurant_staff_display_time_requests
  add column if not exists requested_ends_at timestamptz;

update public.restaurant_staff_display_time_requests
set requested_ends_at = requested_starts_at + interval '8 hours'
where requested_ends_at is null;

alter table public.restaurant_staff_display_time_requests
  alter column requested_ends_at set not null;

comment on column public.restaurant_staff_display_time_requests.entry_type is
  'Gewünschte Art: work, break, sick, vacation (Display-Nachtragung).';

comment on column public.restaurant_staff_display_time_requests.requested_ends_at is
  'Gewünschtes Ende (Display-Nachtragung).';

comment on table public.restaurant_staff_display_time_requests is
  'Display-Anfragen zum Nachtragen von Arbeitszeiten; Freigabe im Mitarbeiter-Dashboard.';
