-- Veranstaltungen: optionales Buchhaltungs-Angebot statt Tisch.

alter table public.reservations
  add column if not exists quotation_id uuid
    references public.accounting_quotations (id) on delete set null;

comment on column public.reservations.quotation_id is
  'Optional verknüpftes Angebot (Buchführung) — vor allem für kind = private_event.';

create index if not exists reservations_quotation_id_idx
  on public.reservations (quotation_id)
  where quotation_id is not null;

create unique index if not exists reservations_quotation_id_unique
  on public.reservations (quotation_id)
  where quotation_id is not null;
