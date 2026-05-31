-- Mitarbeiter-Modul: Stammdaten, Position-Tags, Verträge, Arbeitszeiten, Einladungen.

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Position-Tags (wie Dokument-Tags, HR-Bezeichnung)
-- ---------------------------------------------------------------------------
create table public.restaurant_staff_position_tags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  background_color text not null default '#64748b',
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_position_tags_name_len check (char_length(name) between 1 and 120)
);

create index restaurant_staff_position_tags_restaurant_sort_idx
  on public.restaurant_staff_position_tags (restaurant_id, sort_order, name);

create trigger restaurant_staff_position_tags_set_updated_at
  before update on public.restaurant_staff_position_tags
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff_position_tags enable row level security;

create policy restaurant_staff_position_tags_staff_all
  on public.restaurant_staff_position_tags for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

-- ---------------------------------------------------------------------------
-- Mitarbeiter (mit oder ohne verknüpften App-User)
-- ---------------------------------------------------------------------------
create table public.restaurant_staff (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  profile_id uuid references public.profiles (id) on delete set null,
  employee_id uuid references public.restaurant_employees (id) on delete set null,
  position_tag_id uuid references public.restaurant_staff_position_tags (id) on delete set null,
  restaurant_position_id uuid references public.restaurant_positions (id) on delete set null,
  given_name text not null,
  family_name text not null,
  birth_date date,
  nationality text,
  address_line1 text,
  address_line2 text,
  postal_code text,
  city text,
  country text default 'DE',
  email text,
  phone text,
  is_active boolean not null default true,
  avatar_storage_path text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_given_name_len check (char_length(given_name) between 1 and 120),
  constraint restaurant_staff_family_name_len check (char_length(family_name) between 1 and 120),
  constraint restaurant_staff_email_len check (
    email is null or char_length(email) <= 320
  )
);

create index restaurant_staff_restaurant_active_idx
  on public.restaurant_staff (restaurant_id, is_active, family_name, given_name);

create index restaurant_staff_profile_idx
  on public.restaurant_staff (profile_id)
  where profile_id is not null;

create trigger restaurant_staff_set_updated_at
  before update on public.restaurant_staff
  for each row execute function public.set_updated_at();

alter table public.restaurant_staff enable row level security;

create policy restaurant_staff_staff_all
  on public.restaurant_staff for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff is
  'Restaurant-Mitarbeiter; profile_id gesetzt nach Einladung/Registrierung.';

-- Verknüpfung restaurant_employees ↔ staff
alter table public.restaurant_employees
  add column if not exists staff_id uuid references public.restaurant_staff (id) on delete set null;

create unique index restaurant_employees_staff_id_idx
  on public.restaurant_employees (staff_id)
  where staff_id is not null;

-- ---------------------------------------------------------------------------
-- Einladungen
-- ---------------------------------------------------------------------------
create type public.staff_invite_channel as enum ('email', 'whatsapp');
create type public.staff_invite_status as enum ('pending', 'accepted', 'expired', 'revoked');

create table public.restaurant_staff_invites (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  token_hash text not null,
  channel public.staff_invite_channel not null,
  status public.staff_invite_status not null default 'pending',
  restaurant_position_id uuid not null references public.restaurant_positions (id) on delete restrict,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  accepted_by uuid references auth.users (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index restaurant_staff_invites_token_hash_idx
  on public.restaurant_staff_invites (token_hash);

create index restaurant_staff_invites_staff_idx
  on public.restaurant_staff_invites (staff_id, created_at desc);

alter table public.restaurant_staff_invites enable row level security;

create policy restaurant_staff_invites_staff_select
  on public.restaurant_staff_invites for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_staff_invites_manage
  on public.restaurant_staff_invites for all
  using (public.auth_has_restaurant_permission(restaurant_id, 'team.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'team.manage'));

-- Öffentliche Token-Auflösung (nur pending + nicht abgelaufen)
create or replace function public.resolve_staff_invite_by_token(p_token text)
returns table (
  invite_id uuid,
  restaurant_id uuid,
  staff_id uuid,
  restaurant_name text,
  staff_given_name text,
  staff_family_name text,
  staff_email text,
  position_name text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.restaurant_id,
    i.staff_id,
    r.name,
    s.given_name,
    s.family_name,
    s.email,
    rp.name
  from public.restaurant_staff_invites i
  inner join public.restaurant_staff s on s.id = i.staff_id
  inner join public.restaurants r on r.id = i.restaurant_id
  inner join public.restaurant_positions rp on rp.id = i.restaurant_position_id
  where i.token_hash = encode(extensions.digest(p_token, 'sha256'), 'hex')
    and i.status = 'pending'
    and i.expires_at > timezone('utc', now());
$$;

revoke all on function public.resolve_staff_invite_by_token(text) from public;
grant execute on function public.resolve_staff_invite_by_token(text) to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Verträge
-- ---------------------------------------------------------------------------
create type public.staff_contract_pay_type as enum ('hourly', 'fixed');

create table public.restaurant_staff_contracts (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  valid_from date not null,
  valid_to date,
  pay_type public.staff_contract_pay_type not null,
  hourly_rate_cents integer,
  fixed_salary_cents integer,
  currency text not null default 'EUR',
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_contracts_dates check (
    valid_to is null or valid_to >= valid_from
  ),
  constraint restaurant_staff_contracts_hourly check (
    pay_type <> 'hourly'
    or (hourly_rate_cents is not null and hourly_rate_cents > 0)
  ),
  constraint restaurant_staff_contracts_fixed check (
    pay_type <> 'fixed'
    or (fixed_salary_cents is not null and fixed_salary_cents > 0)
  )
);

create index restaurant_staff_contracts_staff_idx
  on public.restaurant_staff_contracts (staff_id, valid_from desc);

alter table public.restaurant_staff_contracts enable row level security;

create policy restaurant_staff_contracts_staff_all
  on public.restaurant_staff_contracts for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create trigger restaurant_staff_contracts_set_updated_at
  before update on public.restaurant_staff_contracts
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Arbeitszeiten / Abwesenheit (Planung + später Zeiterfassung)
-- ---------------------------------------------------------------------------
create type public.staff_work_entry_type as enum (
  'work',
  'break',
  'vacation',
  'sick',
  'other'
);

create table public.restaurant_staff_work_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  entry_type public.staff_work_entry_type not null default 'work',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_work_entries_range check (ends_at > starts_at)
);

create index restaurant_staff_work_entries_staff_starts_idx
  on public.restaurant_staff_work_entries (staff_id, starts_at);

create index restaurant_staff_work_entries_restaurant_starts_idx
  on public.restaurant_staff_work_entries (restaurant_id, starts_at);

alter table public.restaurant_staff_work_entries enable row level security;

create policy restaurant_staff_work_entries_staff_all
  on public.restaurant_staff_work_entries for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create trigger restaurant_staff_work_entries_set_updated_at
  before update on public.restaurant_staff_work_entries
  for each row execute function public.set_updated_at();

-- Zeiterfassung (Login-System, Vorbereitung)
create type public.staff_presence_status as enum ('off', 'working', 'on_break');

create table public.restaurant_staff_time_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  status public.staff_presence_status not null default 'working',
  clocked_in_at timestamptz not null default timezone('utc', now()),
  clocked_out_at timestamptz,
  break_started_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_time_sessions_clock_order check (
    clocked_out_at is null or clocked_out_at >= clocked_in_at
  )
);

create index restaurant_staff_time_sessions_open_idx
  on public.restaurant_staff_time_sessions (staff_id, clocked_out_at)
  where clocked_out_at is null;

alter table public.restaurant_staff_time_sessions enable row level security;

create policy restaurant_staff_time_sessions_staff_all
  on public.restaurant_staff_time_sessions for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create trigger restaurant_staff_time_sessions_set_updated_at
  before update on public.restaurant_staff_time_sessions
  for each row execute function public.set_updated_at();

-- Dokumente: staff_id statt nur employee_id
alter table public.restaurant_documents
  add column if not exists staff_id uuid references public.restaurant_staff (id) on delete set null;

create index restaurant_documents_staff_idx
  on public.restaurant_documents (staff_id)
  where staff_id is not null;

-- ---------------------------------------------------------------------------
-- Avatar-Storage
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'restaurant-staff-avatars',
  'restaurant-staff-avatars',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy restaurant_staff_avatars_select
  on storage.objects for select
  using (
    bucket_id = 'restaurant-staff-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy restaurant_staff_avatars_insert
  on storage.objects for insert
  with check (
    bucket_id = 'restaurant-staff-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy restaurant_staff_avatars_update
  on storage.objects for update
  using (
    bucket_id = 'restaurant-staff-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );

create policy restaurant_staff_avatars_delete
  on storage.objects for delete
  using (
    bucket_id = 'restaurant-staff-avatars'
    and public.auth_is_restaurant_staff(
      (storage.foldername(name))[1]::uuid
    )
  );
