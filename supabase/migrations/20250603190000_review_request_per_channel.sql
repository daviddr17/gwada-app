-- Bewertungslinks pro Kanal (WhatsApp / E-Mail) unter „Danke & Bewertung“

alter table public.restaurant_reservation_settings
  add column if not exists whatsapp_review_include_gwada boolean not null default true,
  add column if not exists whatsapp_review_include_google boolean not null default false,
  add column if not exists whatsapp_review_include_facebook boolean not null default false,
  add column if not exists email_review_include_gwada boolean not null default true,
  add column if not exists email_review_include_google boolean not null default false,
  add column if not exists email_review_include_facebook boolean not null default false;

update public.restaurant_reservation_settings
set
  whatsapp_review_include_gwada = case
    when review_request_enabled then coalesce(review_request_include_gwada, true)
    else false
  end,
  whatsapp_review_include_google = case
    when review_request_enabled then coalesce(review_request_include_google, false)
    else false
  end,
  whatsapp_review_include_facebook = case
    when review_request_enabled then coalesce(review_request_include_facebook, false)
    else false
  end,
  email_review_include_gwada = case
    when review_request_enabled then coalesce(review_request_include_gwada, true)
    else false
  end,
  email_review_include_google = case
    when review_request_enabled then coalesce(review_request_include_google, false)
    else false
  end,
  email_review_include_facebook = case
    when review_request_enabled then coalesce(review_request_include_facebook, false)
    else false
  end;

comment on column public.restaurant_reservation_settings.whatsapp_review_include_gwada is
  'Gwada-Bewertungslink an WhatsApp-Danke-Nachricht anhängen.';
comment on column public.restaurant_reservation_settings.email_review_include_gwada is
  'Gwada-Bewertungslink an E-Mail-Danke-Nachricht anhängen.';
