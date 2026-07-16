-- POS Zahlungsarten pro Restaurant: feste Presets + eigene (immer Unbar/TSE)

create table if not exists public.pos_restaurant_payment_methods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- cash | unbar | voucher = System-Presets; custom = selbst angelegt
  kind text not null
    check (kind in ('cash', 'unbar', 'voucher', 'custom')),
  label text not null check (char_length(trim(label)) >= 1 and char_length(label) <= 80),
  sort_order integer not null default 0,
  is_active boolean not null default true,
  -- System-Presets (Bar, Unbar, Gutschein) sind nicht löschbar
  is_system boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint pos_restaurant_payment_methods_system_kind_chk
    check (
      (is_system = true and kind in ('cash', 'unbar', 'voucher'))
      or (is_system = false and kind = 'custom')
    )
);

-- Pro Restaurant genau ein System-Preset je Art
create unique index if not exists pos_restaurant_payment_methods_system_kind_uidx
  on public.pos_restaurant_payment_methods (restaurant_id, kind)
  where is_system;

create index if not exists pos_restaurant_payment_methods_restaurant_sort_idx
  on public.pos_restaurant_payment_methods (restaurant_id, sort_order, label);

create trigger pos_restaurant_payment_methods_set_updated_at
  before update on public.pos_restaurant_payment_methods
  for each row execute function public.set_updated_at();

alter table public.pos_restaurant_payment_methods enable row level security;

drop policy if exists pos_restaurant_payment_methods_staff_all
  on public.pos_restaurant_payment_methods;
create policy pos_restaurant_payment_methods_staff_all
  on public.pos_restaurant_payment_methods for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.pos_restaurant_payment_methods is
  'POS Zahlungsarten: Bar/Unbar/Gutschein fest; custom immer Unbar (TSE).';

alter table public.pos_payments
  add column if not exists restaurant_payment_method_id uuid
    references public.pos_restaurant_payment_methods (id) on delete set null;

create index if not exists pos_payments_restaurant_payment_method_id_idx
  on public.pos_payments (restaurant_payment_method_id)
  where restaurant_payment_method_id is not null;

-- Seed Presets für bestehende Restaurants
insert into public.pos_restaurant_payment_methods (
  restaurant_id, kind, label, sort_order, is_active, is_system
)
select r.id, v.kind, v.label, v.sort_order, true, true
from public.restaurants r
cross join (
  values
    ('cash'::text, 'Bar'::text, 0),
    ('unbar', 'Unbar', 1),
    ('voucher', 'Gutschein', 2)
) as v(kind, label, sort_order)
where not exists (
  select 1
  from public.pos_restaurant_payment_methods m
  where m.restaurant_id = r.id
    and m.kind = v.kind
    and m.is_system
);
