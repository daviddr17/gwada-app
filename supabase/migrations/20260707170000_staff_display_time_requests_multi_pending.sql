-- Display: mehrere offene Nachtragungs-Anfragen pro Mitarbeiter

drop index if exists public.restaurant_staff_display_time_requests_one_pending_per_staff_idx;

create index if not exists restaurant_staff_display_time_requests_staff_pending_idx
  on public.restaurant_staff_display_time_requests (staff_id, created_at desc)
  where status = 'pending';

comment on table public.restaurant_staff_display_time_requests is
  'Display-Anfragen zum Nachtragen von Arbeitszeiten; mehrere offene Anfragen pro Mitarbeiter möglich.';
