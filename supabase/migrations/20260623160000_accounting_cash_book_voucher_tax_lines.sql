-- Kassenbuch: Beleg-Zuordnung + Steuerpositionen (Split)

alter table public.accounting_cash_entries
  add column if not exists voucher_id uuid references public.accounting_vouchers (id) on delete set null;

create index if not exists accounting_cash_entries_voucher_id_idx
  on public.accounting_cash_entries (voucher_id)
  where voucher_id is not null;

comment on column public.accounting_cash_entries.voucher_id is
  'Optional verknüpfter Buchführungs-Beleg.';

create table if not exists public.accounting_cash_entry_tax_lines (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references public.accounting_cash_entries (id) on delete cascade,
  sort_order integer not null default 0,
  amount numeric(14, 2) not null,
  tax_rate_percent numeric(8, 4) not null default 0,
  tax_amount numeric(14, 2) not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint accounting_cash_entry_tax_lines_amount_positive check (amount > 0)
);

create index if not exists accounting_cash_entry_tax_lines_entry_id_idx
  on public.accounting_cash_entry_tax_lines (entry_id, sort_order);

create trigger accounting_cash_entry_tax_lines_set_updated_at
  before update on public.accounting_cash_entry_tax_lines
  for each row execute function public.set_updated_at();

alter table public.accounting_cash_entry_tax_lines enable row level security;

create policy accounting_cash_entry_tax_lines_staff_select
  on public.accounting_cash_entry_tax_lines for select
  to authenticated
  using (
    exists (
      select 1
      from public.accounting_cash_entries e
      where e.id = entry_id
        and public.auth_is_restaurant_staff(e.restaurant_id)
    )
  );

create policy accounting_cash_entry_tax_lines_staff_write
  on public.accounting_cash_entry_tax_lines for all
  to authenticated
  using (
    exists (
      select 1
      from public.accounting_cash_entries e
      where e.id = entry_id
        and public.auth_has_restaurant_permission(e.restaurant_id, 'accounting.manage')
    )
  )
  with check (
    exists (
      select 1
      from public.accounting_cash_entries e
      where e.id = entry_id
        and public.auth_has_restaurant_permission(e.restaurant_id, 'accounting.manage')
    )
  );

-- Bestehende Ein-Zeilen-Buchungen in Steuerpositionen überführen
insert into public.accounting_cash_entry_tax_lines (
  entry_id,
  sort_order,
  amount,
  tax_rate_percent,
  tax_amount
)
select
  e.id,
  0,
  e.amount,
  e.tax_rate_percent,
  case
    when e.tax_rate_percent > 0 then
      round((e.amount - e.amount / (1 + e.tax_rate_percent / 100))::numeric, 2)
    else 0
  end
from public.accounting_cash_entries e
where not exists (
  select 1
  from public.accounting_cash_entry_tax_lines l
  where l.entry_id = e.id
);
