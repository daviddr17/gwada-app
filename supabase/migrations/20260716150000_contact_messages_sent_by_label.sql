-- Absender-Klarname für Display-PIN ohne App-Profil (sent_by bleibt Profil-UUID).

alter table public.contact_messages
  add column if not exists sent_by_label text;

comment on column public.contact_messages.sent_by_label is
  'Anzeigename Absender (z. B. Display-Mitarbeiter); Fallback wenn sent_by null.';
