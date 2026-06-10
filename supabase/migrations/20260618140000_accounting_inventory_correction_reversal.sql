-- Bestand bei Rechnungskorrektur zurückbuchen (eigene Einstellung).

alter table public.restaurant_accounting_settings
  add column if not exists reverse_inventory_on_invoice_correction boolean not null default false;

alter table public.accounting_invoices
  add column if not exists inventory_reversed_at timestamptz;

comment on column public.restaurant_accounting_settings.reverse_inventory_on_invoice_correction is
  'Bei Korrektur-Rechnung Bestand für Artikel mit Rezept zurückbuchen (nur wenn Ursprungsrechnung abgebucht hatte).';

comment on column public.accounting_invoices.inventory_reversed_at is
  'Zeitpunkt der Bestandsrückbuchung aus Korrektur-Rechnungspositionen (Rezepte).';
