-- Optionale Adresse am Kontakt (Straße, PLZ, Ort, Land).

alter table public.contacts
  add column if not exists address_street text,
  add column if not exists address_postal_code text,
  add column if not exists address_city text,
  add column if not exists address_country text;
