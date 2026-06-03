-- Protokoll: manuelle Einladung (Ersteller, Versandkanäle)

alter table public.gwada_review_invitations
  add column if not exists created_by uuid references auth.users (id) on delete set null,
  add column if not exists link_sent_at timestamptz,
  add column if not exists link_sent_by uuid references auth.users (id) on delete set null,
  add column if not exists link_sent_channels text[];

comment on column public.gwada_review_invitations.created_by is
  'Nutzer, der den Einladungslink manuell erstellt hat (Bewertungen → Bewertungslink).';
comment on column public.gwada_review_invitations.link_sent_at is
  'Zeitpunkt des ersten Versands des Links über WhatsApp oder E-Mail.';
comment on column public.gwada_review_invitations.link_sent_channels is
  'Kanäle beim ersten Versand, z. B. whatsapp, email.';
