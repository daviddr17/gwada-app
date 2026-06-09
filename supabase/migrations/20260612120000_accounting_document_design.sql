-- Buchführung: Dokument-Design (Layout, Logo, Header/Footer)

alter table public.restaurant_accounting_settings
  add column if not exists document_design jsonb not null default '{}'::jsonb;

alter table public.restaurant_accounting_settings
  drop constraint if exists restaurant_accounting_settings_document_design_is_object;

alter table public.restaurant_accounting_settings
  add constraint restaurant_accounting_settings_document_design_is_object
  check (jsonb_typeof(document_design) = 'object');

comment on column public.restaurant_accounting_settings.document_design is
  'Layout für Gwada-Rechnungen/Angebote: Schrift, Logo, Header/Footer, Firmenblock.';
