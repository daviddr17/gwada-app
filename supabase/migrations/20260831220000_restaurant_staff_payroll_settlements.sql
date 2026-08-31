-- Monats-Abrechnungsstatus je Mitarbeiter (bezahlt / über / unter / offen).

create type public.staff_payroll_settlement_status as enum (
  'open',
  'paid',
  'overpaid',
  'underpaid'
);

create table public.restaurant_staff_payroll_settlements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  period_year smallint not null check (period_year between 2000 and 2100),
  period_month smallint not null check (period_month between 1 and 12),
  status public.staff_payroll_settlement_status not null default 'open',
  -- Bezahlt/überwiesen in diesem Monat (Cent). Bei underpaid: noch offener Rest;
  -- bei overpaid: zu viel gezahlter Betrag.
  amount_cents integer not null default 0 check (amount_cents >= 0),
  note text,
  paid_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_payroll_settlements_note_len check (
    note is null or char_length(note) <= 500
  ),
  constraint restaurant_staff_payroll_settlements_unique_period unique (
    restaurant_id,
    staff_id,
    period_year,
    period_month
  )
);

create index restaurant_staff_payroll_settlements_restaurant_period_idx
  on public.restaurant_staff_payroll_settlements (
    restaurant_id,
    period_year desc,
    period_month desc
  );

create index restaurant_staff_payroll_settlements_staff_period_idx
  on public.restaurant_staff_payroll_settlements (
    staff_id,
    period_year desc,
    period_month desc
  );

alter table public.restaurant_staff_payroll_settlements enable row level security;

create policy restaurant_staff_payroll_settlements_staff_all
  on public.restaurant_staff_payroll_settlements for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create trigger restaurant_staff_payroll_settlements_set_updated_at
  before update on public.restaurant_staff_payroll_settlements
  for each row execute function public.set_updated_at();

comment on table public.restaurant_staff_payroll_settlements is
  'Monatsstatus der Lohnabrechnung je Mitarbeiter (offen/bezahlt/über-/unterzahlt).';
