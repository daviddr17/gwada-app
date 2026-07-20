-- Gemeinsames LAN-Geheimnis pro Restaurant (Hub + alle gekoppelten Handgeräte).

alter table public.restaurants
  add column if not exists pos_lan_shared_secret text;

comment on column public.restaurants.pos_lan_shared_secret is
  'Shared secret für POS-LAN (iPad-Hub ↔ Handheld). Wird bei erster Geräte-Kopplung gesetzt.';
