-- Manuelle Bewertungseinladungen (ohne Reservierung), 24h-Links

alter table public.gwada_review_invitations
  alter column reservation_id drop not null;

alter table public.gwada_review_invitations
  drop constraint if exists gwada_review_invitations_reservation_unique;

create unique index if not exists gwada_review_invitations_reservation_id_unique
  on public.gwada_review_invitations (reservation_id)
  where reservation_id is not null;

comment on column public.gwada_review_invitations.reservation_id is
  'Reservierung bei automatischer Nachfrage; NULL bei manueller Einladung aus Bewertungen.';
