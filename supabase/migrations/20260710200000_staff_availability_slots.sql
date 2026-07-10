-- Mitarbeiter-Verfügbarkeiten (Self-Service + Schichtplan)

create type public.staff_availability_weekday as enum (
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday'
);

create table public.restaurant_staff_availability_slots (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  weekday public.staff_availability_weekday,
  service_date date,
  start_time time not null,
  end_time time not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_availability_slots_kind check (
    (weekday is not null and service_date is null)
    or (weekday is null and service_date is not null)
  ),
  constraint restaurant_staff_availability_slots_time_order check (end_time > start_time),
  constraint restaurant_staff_availability_slots_note_len check (
    note is null or char_length(note) <= 500
  )
);

create index restaurant_staff_availability_slots_restaurant_staff_idx
  on public.restaurant_staff_availability_slots (restaurant_id, staff_id);

create index restaurant_staff_availability_slots_weekday_idx
  on public.restaurant_staff_availability_slots (restaurant_id, staff_id, weekday)
  where weekday is not null;

create index restaurant_staff_availability_slots_service_date_idx
  on public.restaurant_staff_availability_slots (restaurant_id, staff_id, service_date)
  where service_date is not null;

create trigger restaurant_staff_availability_slots_set_updated_at
  before update on public.restaurant_staff_availability_slots
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_availability_slots enable row level security;

create policy restaurant_staff_availability_slots_select
  on public.restaurant_staff_availability_slots for select
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_staff_availability_slots_insert
  on public.restaurant_staff_availability_slots for insert
  to authenticated
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      exists (
        select 1
        from public.restaurant_staff rs
        where rs.id = staff_id
          and rs.restaurant_id = restaurant_id
          and rs.profile_id = (select auth.uid())
      )
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.update')
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
    )
  );

create policy restaurant_staff_availability_slots_update
  on public.restaurant_staff_availability_slots for update
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      exists (
        select 1
        from public.restaurant_staff rs
        where rs.id = staff_id
          and rs.restaurant_id = restaurant_id
          and rs.profile_id = (select auth.uid())
      )
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.update')
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
    )
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      exists (
        select 1
        from public.restaurant_staff rs
        where rs.id = staff_id
          and rs.restaurant_id = restaurant_id
          and rs.profile_id = (select auth.uid())
      )
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.update')
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
    )
  );

create policy restaurant_staff_availability_slots_delete
  on public.restaurant_staff_availability_slots for delete
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      exists (
        select 1
        from public.restaurant_staff rs
        where rs.id = staff_id
          and rs.restaurant_id = restaurant_id
          and rs.profile_id = (select auth.uid())
      )
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.update')
      or public.auth_has_restaurant_permission(restaurant_id, 'staff.manage')
    )
  );

comment on table public.restaurant_staff_availability_slots is
  'Verfügbarkeitsfenster pro Mitarbeiter (wöchentlich oder einmalig).';

alter table public.restaurant_staff_module_settings
  add column if not exists profile_show_availability boolean not null default true;

comment on column public.restaurant_staff_module_settings.profile_show_availability is
  'Mitarbeiter sehen „Meine Verfügbarkeit“ im Profil und können Zeiten pflegen.';
