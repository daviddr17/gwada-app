-- Phase 1b: Session owner, settlement (nach Enum-Erweiterung).

alter table public.pos_table_sessions
  add column if not exists owner_profile_id uuid references public.profiles (id) on delete set null,
  add column if not exists settlement_mode text not null default 'item',
  add column if not exists settled_cents bigint not null default 0,
  add column if not exists even_n integer not null default 2;

alter table public.pos_table_sessions
  drop constraint if exists pos_table_sessions_settlement_mode_chk;

alter table public.pos_table_sessions
  add constraint pos_table_sessions_settlement_mode_chk
  check (settlement_mode in ('item', 'amount'));

alter table public.pos_table_sessions
  drop constraint if exists pos_table_sessions_settled_cents_chk;

alter table public.pos_table_sessions
  add constraint pos_table_sessions_settled_cents_chk
  check (settled_cents >= 0);

alter table public.pos_table_sessions
  drop constraint if exists pos_table_sessions_even_n_chk;

alter table public.pos_table_sessions
  add constraint pos_table_sessions_even_n_chk
  check (even_n >= 1 and even_n <= 12);

comment on column public.pos_table_sessions.owner_profile_id is
  'Aktueller Kellner-Owner (Schichtübergabe wechselt nur diesen Wert).';
comment on column public.pos_table_sessions.settlement_mode is
  'item = Person/Positionen; amount = Gleich-teilen-Pool (Einbahnstraße item→amount).';
comment on column public.pos_table_sessions.settled_cents is
  'Über amount-Anteile bereits beglichene Cent (ohne Tip).';
comment on column public.pos_table_sessions.even_n is
  'Verbleibende Anteile beim Gleich-Teilen.';

update public.pos_table_sessions
set owner_profile_id = opened_by_profile_id
where owner_profile_id is null
  and opened_by_profile_id is not null;

drop index if exists public.pos_table_sessions_one_open_per_table_idx;

create unique index if not exists pos_table_sessions_one_active_per_table_idx
  on public.pos_table_sessions (dining_table_id)
  where status in ('open', 'bill', 'paid_pending_release');

create index if not exists pos_table_sessions_owner_idx
  on public.pos_table_sessions (owner_profile_id, status)
  where owner_profile_id is not null;
