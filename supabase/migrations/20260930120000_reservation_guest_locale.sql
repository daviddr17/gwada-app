-- Language the guest selected when booking. Empty means the restaurant language.
alter table public.reservations
  add column if not exists guest_locale text;

comment on column public.reservations.guest_locale is
  'Short app locale chosen by the guest (de, en, es, fr, it, tr, ar, zh). Null uses the restaurant default.';

alter table public.reservations
  drop constraint if exists reservations_guest_locale_check;

alter table public.reservations
  add constraint reservations_guest_locale_check
  check (
    guest_locale is null
    or guest_locale in ('de', 'en', 'es', 'fr', 'it', 'tr', 'ar', 'zh')
  );
