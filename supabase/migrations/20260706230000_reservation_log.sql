-- Änderungsprotokoll für Reservierungen (pro Reservierung + Modul-Übersicht).

create table public.restaurant_reservation_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  reservation_id uuid references public.reservations (id) on delete set null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (
    action in (
      'created',
      'updated',
      'deleted',
      'change_request_submitted',
      'change_request_approved',
      'change_request_declined'
    )
  ),
  reservation_number integer,
  guest_label text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_reservation_log_guest_label_len check (
    char_length(guest_label) between 1 and 255
  )
);

create index restaurant_reservation_log_restaurant_created_idx
  on public.restaurant_reservation_log_entries (restaurant_id, created_at desc);

create index restaurant_reservation_log_reservation_created_idx
  on public.restaurant_reservation_log_entries (reservation_id, created_at desc)
  where reservation_id is not null;

alter table public.restaurant_reservation_log_entries enable row level security;

create policy restaurant_reservation_log_select
  on public.restaurant_reservation_log_entries for select
  using (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
  );

create policy restaurant_reservation_log_insert
  on public.restaurant_reservation_log_entries for insert
  with check (
    public.auth_has_restaurant_permission(restaurant_id, 'reservations.manage')
    or auth.role() = 'service_role'
  );

comment on table public.restaurant_reservation_log_entries is
  'Audit trail: Reservierungen angelegt, bearbeitet, gelöscht, Änderungsanfragen.';

-- Bestehende Reservierungen: Erstell-Eintrag (ohne Feld-Diff).
insert into public.restaurant_reservation_log_entries (
  restaurant_id,
  reservation_id,
  actor_user_id,
  action,
  reservation_number,
  guest_label,
  details,
  created_at
)
select
  r.restaurant_id,
  r.id,
  r.created_by_profile_id,
  'created',
  r.reservation_number,
  '#' || r.reservation_number::text || ' · ' || trim(
    coalesce(nullif(trim(r.guest_first_name), ''), 'Gast') || ' ' ||
    coalesce(trim(r.guest_last_name), '')
  ),
  jsonb_build_object(
    'actorSource',
    case when r.created_by_profile_id is null then 'guest' else 'staff' end,
    'summary',
    'Erstellt (Bestand)'
  ),
  r.created_at
from public.reservations r
where not exists (
  select 1
  from public.restaurant_reservation_log_entries e
  where e.reservation_id = r.id
    and e.action = 'created'
);
