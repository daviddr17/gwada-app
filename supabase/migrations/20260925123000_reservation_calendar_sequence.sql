-- SEQUENCE der Kalendereinladung pro Reservierung.
-- Gleiche UID, höhere SEQUENCE aktualisiert denselben Termin in der Bestätigungsmail.

alter table public.reservations
  add column if not exists calendar_sequence integer not null default 0;

alter table public.reservations
  add column if not exists calendar_fingerprint text;

alter table public.reservations
  add column if not exists calendar_emailed_fingerprint text;

comment on column public.reservations.calendar_sequence is
  'iCalendar SEQUENCE der Gäste-Einladung. Steigt, wenn Zeit, Ort oder Personenzahl sich ändern.';

comment on column public.reservations.calendar_fingerprint is
  'Letzter Stand (Zeit, Ende, Personen, Tisch, Ort), zu dem calendar_sequence gehört.';

comment on column public.reservations.calendar_emailed_fingerprint is
  'Fingerprint, der zuletzt als METHOD:REQUEST per E-Mail rausging.';
