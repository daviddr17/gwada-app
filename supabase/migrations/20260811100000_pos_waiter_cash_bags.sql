-- Kellner-Portemonnaie (Börse) unter Register-Session + Bewegungsjournal.

create table public.pos_waiter_cash_bags (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  register_session_id uuid not null references public.pos_register_sessions (id) on delete restrict,
  staff_profile_id uuid not null,
  status text not null check (status in ('open', 'handed_over', 'closed')),
  opening_float_cents bigint not null check (opening_float_cents >= 0),
  closing_count_cents bigint null check (closing_count_cents is null or closing_count_cents >= 0),
  difference_cents bigint null,
  opened_at timestamptz not null default now(),
  closed_at timestamptz null,
  opened_by_profile_id uuid null,
  closed_by_profile_id uuid null,
  manager_override_profile_id uuid null,
  handed_over_to_bag_id uuid null references public.pos_waiter_cash_bags (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index pos_waiter_cash_bags_one_open_per_staff
  on public.pos_waiter_cash_bags (restaurant_id, staff_profile_id)
  where status = 'open';

create index pos_waiter_cash_bags_register_idx
  on public.pos_waiter_cash_bags (register_session_id);

create trigger pos_waiter_cash_bags_set_updated_at
  before update on public.pos_waiter_cash_bags
  for each row execute function public.set_updated_at();

alter table public.pos_waiter_cash_bags enable row level security;

create policy pos_waiter_cash_bags_staff_select
  on public.pos_waiter_cash_bags for select
  using (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_waiter_cash_bags is
  'Kellner-Börse unter Kassensitzung: Wechselgeld, Bar-Kassierungen, Schichtübergabe, Schichtende.';

create table public.pos_waiter_cash_bag_movements (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  cash_bag_id uuid not null references public.pos_waiter_cash_bags (id) on delete cascade,
  register_session_id uuid not null references public.pos_register_sessions (id) on delete restrict,
  kind text not null check (kind in (
    'float_out', 'cash_sale', 'drop_in', 'handover', 'close_count'
  )),
  amount_cents bigint not null,
  -- float_out/cash_sale/drop_in: signed effect on bag (+/-); close_count stores counted Ist
  payment_id uuid null,
  idempotency_key text null,
  note text null,
  created_by_profile_id uuid null,
  created_at timestamptz not null default now()
);

create unique index pos_waiter_cash_bag_movements_idem
  on public.pos_waiter_cash_bag_movements (restaurant_id, idempotency_key)
  where idempotency_key is not null;

create index pos_waiter_cash_bag_movements_bag_idx
  on public.pos_waiter_cash_bag_movements (cash_bag_id, created_at desc);

alter table public.pos_waiter_cash_bag_movements enable row level security;

create policy pos_waiter_cash_bag_movements_staff_select
  on public.pos_waiter_cash_bag_movements for select
  using (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_waiter_cash_bag_movements is
  'Append-only Journal für Kellner-Börsen (float_out, cash_sale, drop_in, handover, close_count).';

alter table public.pos_payments
  add column if not exists cashier_profile_id uuid null,
  add column if not exists cash_bag_id uuid null
    references public.pos_waiter_cash_bags (id) on delete set null;

create index pos_payments_cash_bag_id_idx
  on public.pos_payments (cash_bag_id)
  where cash_bag_id is not null;

alter table public.pos_restaurant_fiscal_config
  add column if not exists waiter_cash_bag_diff_threshold_cents bigint not null default 500
    check (waiter_cash_bag_diff_threshold_cents >= 0);

comment on column public.pos_restaurant_fiscal_config.waiter_cash_bag_diff_threshold_cents is
  'Schwellwert (Cent) für Manager-PIN bei Börsen-Differenz beim Schließen; Default 500 (5,00 €).';
