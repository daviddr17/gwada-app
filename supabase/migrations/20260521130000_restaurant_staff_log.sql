-- Änderungsprotokoll je Mitarbeiter

create table public.restaurant_staff_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (action in ('created', 'updated')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index restaurant_staff_log_staff_created_idx
  on public.restaurant_staff_log_entries (staff_id, created_at desc);

alter table public.restaurant_staff_log_entries enable row level security;

create policy restaurant_staff_log_staff_select
  on public.restaurant_staff_log_entries for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy restaurant_staff_log_staff_insert
  on public.restaurant_staff_log_entries for insert
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.restaurant_staff_log_entries is
  'Änderungsprotokoll je Mitarbeiter (Wer, Wann, Was).';
