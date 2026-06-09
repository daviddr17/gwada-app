-- Optionales Lieferdatum für Rechnungen und Angebote

alter table public.accounting_invoices
  add column if not exists delivery_date date;

alter table public.accounting_quotations
  add column if not exists delivery_date date;
