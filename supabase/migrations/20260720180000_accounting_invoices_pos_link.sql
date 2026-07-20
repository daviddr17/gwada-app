-- Formale Rechnung aus POS-Quittung: Verknüpfung Payment/Order

alter table public.accounting_invoices
  add column if not exists pos_payment_id uuid
    references public.pos_payments (id) on delete set null;

alter table public.accounting_invoices
  add column if not exists pos_order_id uuid
    references public.pos_orders (id) on delete set null;

create unique index if not exists accounting_invoices_pos_payment_uidx
  on public.accounting_invoices (restaurant_id, pos_payment_id)
  where pos_payment_id is not null;

create index if not exists accounting_invoices_pos_order_idx
  on public.accounting_invoices (restaurant_id, pos_order_id)
  where pos_order_id is not null;

comment on column public.accounting_invoices.pos_payment_id is
  'POS-Zahlung, aus der diese formale Rechnung erzeugt wurde (max. eine pro Payment).';
comment on column public.accounting_invoices.pos_order_id is
  'POS-Bestellung zur formalen Rechnung (Denormalisierung).';
