-- Korrekturbuchungen (Gutschriften) für Rechnungen und Belege

alter table public.accounting_invoices
  add column if not exists document_variant text not null default 'standard'
    check (document_variant in ('standard', 'correction')),
  add column if not exists corrects_id uuid references public.accounting_invoices (id) on delete set null,
  add column if not exists external_document_type text;

comment on column public.accounting_invoices.document_variant is
  'standard = Ausgangsrechnung, correction = Korrektur/Gutschrift.';
comment on column public.accounting_invoices.corrects_id is
  'Referenz auf die korrigierte Rechnung (Gwada-Spiegel).';
comment on column public.accounting_invoices.external_document_type is
  'Connector-Dokumenttyp, z. B. invoice, credit_note — für PDF/Sync.';

create index if not exists accounting_invoices_corrects_id_idx
  on public.accounting_invoices (corrects_id)
  where corrects_id is not null;

alter table public.accounting_vouchers
  add column if not exists document_variant text not null default 'standard'
    check (document_variant in ('standard', 'correction')),
  add column if not exists corrects_id uuid references public.accounting_vouchers (id) on delete set null;

comment on column public.accounting_vouchers.document_variant is
  'standard = Beleg, correction = Korrektur/Gutschrift zum Ursprungsbeleg.';

create index if not exists accounting_vouchers_corrects_id_idx
  on public.accounting_vouchers (corrects_id)
  where corrects_id is not null;

alter table public.restaurant_accounting_settings
  add column if not exists invoice_correction_number_prefix text not null default 'KO';

comment on column public.restaurant_accounting_settings.invoice_correction_number_prefix is
  'Präfix für Gwada-Korrekturrechnungen, z. B. KO-2026-0001.';

alter table public.restaurant_accounting_document_counters
  drop constraint if exists restaurant_accounting_document_counters_document_kind_check;

alter table public.restaurant_accounting_document_counters
  add constraint restaurant_accounting_document_counters_document_kind_check
  check (document_kind in ('invoice', 'quotation', 'invoice_correction'));

create or replace function public.peek_accounting_document_number(
  p_restaurant_id uuid,
  p_kind text
)
returns bigint
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if p_kind not in ('invoice', 'quotation', 'invoice_correction') then
    raise exception 'invalid document kind';
  end if;

  select c.next_number + 1
  into n
  from public.restaurant_accounting_document_counters c
  where c.restaurant_id = p_restaurant_id
    and c.document_kind = p_kind;

  return coalesce(n, 1);
end;
$$;

create or replace function public.allocate_accounting_document_number(
  p_restaurant_id uuid,
  p_kind text
)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  n bigint;
begin
  if p_kind not in ('invoice', 'quotation', 'invoice_correction') then
    raise exception 'invalid document kind';
  end if;

  insert into public.restaurant_accounting_document_counters as c
    (restaurant_id, document_kind, next_number)
  values (p_restaurant_id, p_kind, 1)
  on conflict (restaurant_id, document_kind) do update
    set next_number = c.next_number + 1
  returning c.next_number into n;

  return n;
end;
$$;
