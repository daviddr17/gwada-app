-- Gwada-eigene fortlaufende Rechnungs-/Angebotsnummern (unabhängig von Lexware)

alter table public.restaurant_accounting_settings
  add column if not exists invoice_number_prefix text not null default 'RE',
  add column if not exists quotation_number_prefix text not null default 'AN',
  add column if not exists invoice_number_include_year boolean not null default true,
  add column if not exists quotation_number_include_year boolean not null default true,
  add column if not exists invoice_number_min_digits integer not null default 4
    check (invoice_number_min_digits between 1 and 10),
  add column if not exists quotation_number_min_digits integer not null default 4
    check (quotation_number_min_digits between 1 and 10);

comment on column public.restaurant_accounting_settings.invoice_number_prefix is
  'Präfix für Gwada-Rechnungsnummern, z. B. RE → RE-2026-0001.';
comment on column public.restaurant_accounting_settings.quotation_number_prefix is
  'Präfix für Gwada-Angebotsnummern, z. B. AN → AN-2026-0001.';

create table if not exists public.restaurant_accounting_document_counters (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_kind text not null check (document_kind in ('invoice', 'quotation')),
  next_number bigint not null default 0,
  primary key (restaurant_id, document_kind)
);

comment on table public.restaurant_accounting_document_counters is
  'next_number = zuletzt vergebene laufende Nummer je Restaurant und Dokumenttyp.';

alter table public.restaurant_accounting_document_counters enable row level security;

drop policy if exists restaurant_accounting_document_counters_staff
  on public.restaurant_accounting_document_counters;
create policy restaurant_accounting_document_counters_staff
  on public.restaurant_accounting_document_counters for all
  to authenticated
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

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
  if p_kind not in ('invoice', 'quotation') then
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
  if p_kind not in ('invoice', 'quotation') then
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

grant execute on function public.peek_accounting_document_number(uuid, text)
  to authenticated;
grant execute on function public.allocate_accounting_document_number(uuid, text)
  to authenticated;
