-- Lexware-Rechnungen/Angebote: updatedDate für inkrementellen Detail-Abruf

alter table public.accounting_invoices
  add column if not exists external_updated_at timestamptz;

alter table public.accounting_quotations
  add column if not exists external_updated_at timestamptz;

comment on column public.accounting_invoices.external_updated_at is
  'Lexware voucherlist updatedDate — steuert Detail-Abruf (Positionen) beim Sync.';

comment on column public.accounting_quotations.external_updated_at is
  'Lexware voucherlist updatedDate — steuert Detail-Abruf (Positionen) beim Sync.';
