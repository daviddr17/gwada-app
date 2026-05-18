-- Global reservation statuses (name + color) and extended reservation fields.
-- Replaces enum public.reservation_status with FK to public.reservation_statuses.

-- ---------------------------------------------------------------------------
-- Status catalog (global, all restaurants)
-- ---------------------------------------------------------------------------
create table public.reservation_statuses (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  color_hex text not null
    check (color_hex ~ '^#[0-9A-Fa-f]{6}$'),
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

comment on table public.reservation_statuses is
  'Global reservation status labels and UI colors (shared across restaurants).';

insert into public.reservation_statuses (code, name, color_hex, sort_order) values
  ('pending', 'Offen', '#2563eb', 10),
  ('confirmed', 'Bestätigt', '#16a34a', 20),
  ('cancelled', 'Storniert', '#dc2626', 30),
  ('declined', 'Abgesagt', '#dc2626', 35),
  ('seated', 'Am Tisch', '#0d9488', 40),
  ('completed', 'Abgeschlossen', '#64748b', 50),
  ('no_show', 'Nicht erschienen', '#b45309', 60);

alter table public.reservation_statuses enable row level security;

create policy "reservation_statuses_select_authenticated"
  on public.reservation_statuses for select
  to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- Reservations: new columns + migrate from enum
-- ---------------------------------------------------------------------------
alter table public.reservations
  add column if not exists status_id uuid references public.reservation_statuses (id);

update public.reservations r
set status_id = s.id
from public.reservation_statuses s
where r.status_id is null
  and s.code = r.status::text;

alter table public.reservations
  alter column status_id set not null;

alter table public.reservations drop column status;

drop type public.reservation_status;

alter table public.reservations
  add column if not exists reservation_number integer;

update public.reservations r
set reservation_number = sq.n
from (
  select
    id,
    row_number() over (
      partition by restaurant_id
      order by created_at asc, id asc
    ) as n
  from public.reservations
) sq
where r.id = sq.id
  and (r.reservation_number is null or r.reservation_number <= 0);

alter table public.reservations
  alter column reservation_number set not null;

alter table public.reservations
  add constraint reservations_restaurant_number_uniq
    unique (restaurant_id, reservation_number);

alter table public.reservations
  add column if not exists guest_first_name text,
  add column if not exists guest_last_name text,
  add column if not exists guest_pin_hash text,
  add column if not exists notify_email boolean not null default true,
  add column if not exists notify_whatsapp boolean not null default false,
  add column if not exists terms_accepted boolean not null default false;

update public.reservations
set guest_first_name = coalesce(
    nullif(trim(split_part(coalesce(guest_name, ''), ' ', 1)), ''),
    'Gast'
  )
where guest_first_name is null;

update public.reservations
set guest_last_name = coalesce(
    nullif(
      trim(
        substring(
          coalesce(guest_name, '')
          from greatest(length(split_part(coalesce(guest_name, ''), ' ', 1)) + 2, 1)
        )
      ),
      ''
    ),
    ''
  )
where guest_last_name is null;

alter table public.reservations
  alter column guest_first_name set not null,
  alter column guest_last_name set not null;

comment on column public.reservations.reservation_number is
  'Fortlaufende Nummer je Restaurant (Vergabe per Trigger, außer manuell gesetzt).';
comment on column public.reservations.guest_pin_hash is
  'bcrypt-Hash der Änderungs-PIN für Gäste ohne Login (pgcrypto crypt).';
comment on column public.reservations.notify_email is
  'Gast möchte E-Mail-Benachrichtigungen.';
comment on column public.reservations.notify_whatsapp is
  'Gast möchte WhatsApp-Benachrichtigungen.';
comment on column public.reservations.terms_accepted is
  'AGB / Buchungsbedingungen akzeptiert.';

-- ---------------------------------------------------------------------------
-- Per-restaurant counter for reservation_number
-- ---------------------------------------------------------------------------
create table public.restaurant_reservation_counters (
  restaurant_id uuid primary key references public.restaurants (id) on delete cascade,
  next_number bigint not null default 0
);

comment on table public.restaurant_reservation_counters is
  'next_number = zuletzt vergebene reservation_number; Trigger vergibt next_number + 1.';

insert into public.restaurant_reservation_counters (restaurant_id, next_number)
select restaurant_id, coalesce(max(reservation_number), 0)
from public.reservations
group by restaurant_id
on conflict (restaurant_id) do update
  set next_number = greatest(
    public.restaurant_reservation_counters.next_number,
    excluded.next_number
  );

create or replace function public.reservations_assign_number_and_counter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if new.reservation_number is not null and new.reservation_number > 0 then
    insert into public.restaurant_reservation_counters as c (restaurant_id, next_number)
    values (new.restaurant_id, new.reservation_number)
    on conflict (restaurant_id) do update
      set next_number = greatest(c.next_number, excluded.next_number);
    return new;
  end if;

  insert into public.restaurant_reservation_counters as c (restaurant_id, next_number)
  values (new.restaurant_id, 1)
  on conflict (restaurant_id) do update
    set next_number = c.next_number + 1
  returning c.next_number into n;

  new.reservation_number := n;
  return new;
end;
$$;

drop trigger if exists reservations_assign_number on public.reservations;

create trigger reservations_assign_number
  before insert on public.reservations
  for each row execute function public.reservations_assign_number_and_counter();

alter table public.restaurant_reservation_counters enable row level security;

create policy "restaurant_reservation_counters_staff"
  on public.restaurant_reservation_counters for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));
