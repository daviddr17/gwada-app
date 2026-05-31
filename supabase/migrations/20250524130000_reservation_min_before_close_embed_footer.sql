-- Mindestabstand vor Schließung + Hinweistext unter dem Embed-Formular.
alter table public.restaurant_reservation_settings
  add column if not exists min_minutes_before_closing integer not null default 60
    check (
      min_minutes_before_closing >= 0
      and min_minutes_before_closing <= 480
    );

alter table public.restaurant_reservation_settings
  add column if not exists embed_form_footer_text text;

alter table public.restaurant_reservation_settings
  drop constraint if exists restaurant_reservation_settings_embed_footer_len_check;

alter table public.restaurant_reservation_settings
  add constraint restaurant_reservation_settings_embed_footer_len_check
  check (
    embed_form_footer_text is null
    or char_length(embed_form_footer_text) <= 2000
  );

comment on column public.restaurant_reservation_settings.min_minutes_before_closing is
  'Letzter buchbarer Reservierungsbeginn: Schließzeit minus diese Minuten (Embed).';

comment on column public.restaurant_reservation_settings.embed_form_footer_text is
  'Optionaler Hinweistext unter dem öffentlichen Reservierungsformular (Embed).';
