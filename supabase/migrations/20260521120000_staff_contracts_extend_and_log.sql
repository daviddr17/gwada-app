-- Verträge: Beschäftigungsart, Urlaubstage, Protokoll

create type public.staff_employment_type as enum (
  'full_time',
  'part_time',
  'mini_job',
  'fixed_term',
  'internship',
  'student',
  'other'
);

alter table public.restaurant_staff_contracts
  add column if not exists employment_type public.staff_employment_type,
  add column if not exists vacation_days_per_year integer;

alter table public.restaurant_staff_contracts
  add constraint restaurant_staff_contracts_vacation_days_nonneg check (
    vacation_days_per_year is null or vacation_days_per_year >= 0
  );

comment on column public.restaurant_staff_contracts.employment_type is
  'Art des Beschäftigungsverhältnisses';
comment on column public.restaurant_staff_contracts.vacation_days_per_year is
  'Jährlicher Urlaubsanspruch in Tagen';

-- ---------------------------------------------------------------------------
-- Vertragsprotokoll
-- ---------------------------------------------------------------------------
create table public.restaurant_staff_contract_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contract_id uuid not null references public.restaurant_staff_contracts (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('created', 'updated')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index restaurant_staff_contract_log_contract_created_idx
  on public.restaurant_staff_contract_log_entries (contract_id, created_at desc);

alter table public.restaurant_staff_contract_log_entries enable row level security;

create policy restaurant_staff_contract_log_staff_select
  on public.restaurant_staff_contract_log_entries for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_staff_contract_log_staff_insert
  on public.restaurant_staff_contract_log_entries for insert
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_contract_log_entries is
  'Änderungsprotokoll je Mitarbeitervertrag (Wer, Wann, Was).';
