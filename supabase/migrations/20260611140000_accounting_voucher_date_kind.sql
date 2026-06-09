-- Rechnungs-/Angebotsdatum vs. Zeitraum

alter table public.accounting_invoices
  add column if not exists voucher_date_kind text not null default 'date'
    check (voucher_date_kind in ('date', 'period')),
  add column if not exists voucher_period_start date,
  add column if not exists voucher_period_end date;

alter table public.accounting_quotations
  add column if not exists voucher_date_kind text not null default 'date'
    check (voucher_date_kind in ('date', 'period')),
  add column if not exists voucher_period_start date,
  add column if not exists voucher_period_end date;
