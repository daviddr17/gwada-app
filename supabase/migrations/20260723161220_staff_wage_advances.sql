-- Lohnvorschüsse für Mitarbeiter-Abrechnung (Arbeitszeiten).

create table public.restaurant_staff_wage_advances (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  staff_id uuid not null references public.restaurant_staff (id) on delete cascade,
  amount_cents integer not null,
  paid_on date not null,
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint restaurant_staff_wage_advances_amount_positive check (amount_cents > 0),
  constraint restaurant_staff_wage_advances_note_len check (
    note is null or char_length(note) <= 500
  )
);

create index restaurant_staff_wage_advances_staff_paid_on_idx
  on public.restaurant_staff_wage_advances (staff_id, paid_on desc);

create index restaurant_staff_wage_advances_restaurant_paid_on_idx
  on public.restaurant_staff_wage_advances (restaurant_id, paid_on desc);

alter table public.restaurant_staff_wage_advances enable row level security;

create policy restaurant_staff_wage_advances_staff_all
  on public.restaurant_staff_wage_advances for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create trigger restaurant_staff_wage_advances_set_updated_at
  before update on public.restaurant_staff_wage_advances
  for each row execute function public.set_updated_at();

comment on table public.restaurant_staff_wage_advances is
  'Lohnvorschüsse je Mitarbeiter; Zuordnung über paid_on zum Abrechnungsmonat.';
