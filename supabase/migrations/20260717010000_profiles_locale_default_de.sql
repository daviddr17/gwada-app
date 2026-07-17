-- UI language preference: align new profiles with the German product default.
-- Legacy rows may still have `fr-GP` (old default); the app treats that as unset
-- until the user picks a language in Profil.
alter table public.profiles
  alter column locale set default 'de-DE';

comment on column public.profiles.locale is
  'UI language preference (BCP-47), e.g. de-DE, en-US, fr-FR. Set from Profil → Sprache.';
