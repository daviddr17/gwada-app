-- Tagesnotizen für Reservierungen (pro Kalendertag, protokollartig).

create table public.restaurant_reservation_day_note_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  service_date date not null,
  employee_id uuid references public.restaurant_employees (id) on delete set null,
  actor_user_id uuid not null references auth.users (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_reservation_day_note_body_len check (
    char_length(body) between 1 and 5000
  )
);

create index restaurant_reservation_day_note_restaurant_date_idx
  on public.restaurant_reservation_day_note_entries (
    restaurant_id,
    service_date,
    created_at desc
  );

create trigger restaurant_reservation_day_note_set_updated_at
  before update on public.restaurant_reservation_day_note_entries
  for each row execute function public.set_updated_at();

alter table public.restaurant_reservation_day_note_entries enable row level security;

create policy restaurant_reservation_day_note_staff_select
  on public.restaurant_reservation_day_note_entries for select
  to authenticated
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.read')
    or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

create policy restaurant_reservation_day_note_staff_insert
  on public.restaurant_reservation_day_note_entries for insert
  to authenticated
  with check (
    actor_user_id = (select auth.uid())
    and (
      public.auth_has_restaurant_permission(restaurant_id, 'reservations.read')
      or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    )
  );

create policy restaurant_reservation_day_note_own_update
  on public.restaurant_reservation_day_note_entries for update
  to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.auth_has_restaurant_permission(restaurant_id, 'reservations.read')
      or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    )
  )
  with check (
    actor_user_id = (select auth.uid())
    and (
      public.auth_has_restaurant_permission(restaurant_id, 'reservations.read')
      or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    )
  );

create policy restaurant_reservation_day_note_own_delete
  on public.restaurant_reservation_day_note_entries for delete
  to authenticated
  using (
    actor_user_id = (select auth.uid())
    and (
      public.auth_has_restaurant_permission(restaurant_id, 'reservations.read')
      or public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    )
  );

comment on table public.restaurant_reservation_day_note_entries is
  'Protokollartige Tagesnotizen im Reservierungs-Dashboard — Bearbeiten/Löschen nur durch Autor.';
