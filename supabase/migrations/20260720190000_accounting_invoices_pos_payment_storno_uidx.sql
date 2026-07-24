-- Nach Rechnungsstorno (status = voided) darf dieselbe POS-Zahlung
-- erneut eine formale Rechnung bekommen.

drop index if exists public.accounting_invoices_pos_payment_uidx;

create unique index if not exists accounting_invoices_pos_payment_uidx
  on public.accounting_invoices (restaurant_id, pos_payment_id)
  where pos_payment_id is not null
    and status is distinct from 'voided';

comment on index public.accounting_invoices_pos_payment_uidx is
  'Max. eine aktive formale Rechnung pro POS-Zahlung (stornierte ausgenommen).';
