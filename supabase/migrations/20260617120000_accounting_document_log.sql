-- Buchführung: Protokoll je Rechnung, Angebot, Beleg

create table public.accounting_document_log_entries (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  document_kind text not null check (document_kind in ('invoice', 'quotation', 'voucher')),
  document_id uuid not null,
  actor_user_id uuid references auth.users (id) on delete set null,
  action text not null check (
    action in ('created', 'updated', 'sent', 'deleted', 'synced', 'attachment_uploaded')
  ),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index accounting_document_log_document_created_idx
  on public.accounting_document_log_entries (document_kind, document_id, created_at desc);

create index accounting_document_log_restaurant_created_idx
  on public.accounting_document_log_entries (restaurant_id, created_at desc);

alter table public.accounting_document_log_entries enable row level security;

create policy accounting_document_log_staff_select
  on public.accounting_document_log_entries for select
  using (public.auth_is_restaurant_staff(restaurant_id));

create policy accounting_document_log_staff_insert
  on public.accounting_document_log_entries for insert
  with check (public.auth_is_restaurant_staff(restaurant_id));

comment on table public.accounting_document_log_entries is
  'Protokoll je Rechnung, Angebot oder Beleg (Wer, Wann, Was — inkl. Versand).';
