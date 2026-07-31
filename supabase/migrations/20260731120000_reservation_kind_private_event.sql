-- Veranstaltungen als Reservierungs-Subtyp + Mitarbeiter-Zuweisung.

alter table public.reservations
  add column if not exists kind text not null default 'guest';

alter table public.reservations
  drop constraint if exists reservations_kind_check;

alter table public.reservations
  add constraint reservations_kind_check
  check (kind in ('guest', 'private_event'));

comment on column public.reservations.kind is
  'guest = normale Reservierung; private_event = manuelle Veranstaltung (Dashboard).';

create index if not exists reservations_restaurant_kind_starts_idx
  on public.reservations (restaurant_id, kind, starts_at);

create table if not exists public.reservation_staff_assignees (
  reservation_id uuid not null references public.reservations (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (reservation_id, staff_id)
);

create index if not exists reservation_staff_assignees_staff_idx
  on public.reservation_staff_assignees (staff_id);

comment on table public.reservation_staff_assignees is
  'Mitarbeiter, die einer Veranstaltung / Reservierung zugewiesen sind.';

alter table public.reservation_staff_assignees enable row level security;

drop policy if exists reservation_staff_assignees_select on public.reservation_staff_assignees;
create policy reservation_staff_assignees_select
  on public.reservation_staff_assignees for select
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and (
          public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.read')
          or public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.manage')
        )
    )
  );

drop policy if exists reservation_staff_assignees_insert on public.reservation_staff_assignees;
create policy reservation_staff_assignees_insert
  on public.reservation_staff_assignees for insert
  to authenticated
  with check (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.manage')
    )
    and exists (
      select 1
      from public.reservations r
      join public.restaurant_staff s on s.id = staff_id
      where r.id = reservation_id
        and s.restaurant_id = r.restaurant_id
    )
  );

drop policy if exists reservation_staff_assignees_delete on public.reservation_staff_assignees;
create policy reservation_staff_assignees_delete
  on public.reservation_staff_assignees for delete
  to authenticated
  using (
    exists (
      select 1 from public.reservations r
      where r.id = reservation_id
        and public.auth_has_restaurant_permission(r.restaurant_id, 'reservations.manage')
    )
  );
