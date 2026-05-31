-- Gast-Änderungsanfragen aus dem Embed: Vorschlag in pending_change, Status „Änderung angefragt“.

insert into public.reservation_statuses (code, name, color_hex, sort_order)
values ('change_requested', 'Änderung angefragt', '#d97706', 15)
on conflict (code) do update
set
  name = excluded.name,
  color_hex = excluded.color_hex,
  sort_order = excluded.sort_order;

alter table public.reservations
  add column if not exists pending_change jsonb;

alter table public.reservations
  add column if not exists status_before_change_id uuid
  references public.reservation_statuses (id);

comment on column public.reservations.pending_change is
  'Vorgeschlagene Felder durch Gast-Änderung (JSON), bis Restaurant bestätigt oder ablehnt.';

comment on column public.reservations.status_before_change_id is
  'Status vor change_requested — wird bei Übernahme/Ablehnung wiederhergestellt.';
