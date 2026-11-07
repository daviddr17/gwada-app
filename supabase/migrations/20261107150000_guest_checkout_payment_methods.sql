-- GW-82: Per-restaurant guest payment methods for Online & Kiosk.
-- Gwada-owned checkout selects methods; Mollie is backend-only
-- (pointofsale / terminal / API) — never Hosted Checkout redirect.

alter table public.restaurant_online_ordering_settings
  add column if not exists guest_pay_online_card_terminal boolean not null default false,
  add column if not exists guest_pay_online_cash boolean not null default true,
  add column if not exists guest_pay_online_paypal boolean not null default false,
  add column if not exists guest_pay_online_softpos boolean not null default false,
  add column if not exists guest_pay_kiosk_card_terminal boolean not null default true,
  add column if not exists guest_pay_kiosk_cash boolean not null default false,
  add column if not exists guest_pay_kiosk_paypal boolean not null default false,
  add column if not exists guest_pay_kiosk_softpos boolean not null default false;

comment on column public.restaurant_online_ordering_settings.guest_pay_online_card_terminal is
  'Online guest: card via Mollie terminal/pointofsale (in-store tablet) when a term_ is available.';
comment on column public.restaurant_online_ordering_settings.guest_pay_online_cash is
  'Online guest: pay cash at pickup / on delivery (Gwada-only, no Mollie).';
comment on column public.restaurant_online_ordering_settings.guest_pay_online_paypal is
  'Online guest: PayPal via Mollie Payments API (method pinned; Gwada owns method selection).';
comment on column public.restaurant_online_ordering_settings.guest_pay_online_softpos is
  'Online guest: SoftPOS / Tap to Pay via Mollie pointofsale + SoftPOS term_ when available.';
comment on column public.restaurant_online_ordering_settings.guest_pay_kiosk_card_terminal is
  'Kiosk/table guest: card via Mollie pointofsale terminal.';
comment on column public.restaurant_online_ordering_settings.guest_pay_kiosk_cash is
  'Kiosk/table guest: cash at counter (Gwada-only).';
comment on column public.restaurant_online_ordering_settings.guest_pay_kiosk_paypal is
  'Kiosk/table guest: PayPal via Mollie Payments API (method pinned).';
comment on column public.restaurant_online_ordering_settings.guest_pay_kiosk_softpos is
  'Kiosk/table guest: SoftPOS / Tap to Pay via Mollie pointofsale.';
