-- Online ordering timing: ASAP vs Wunschzeit (replaces guest-facing timeslot capacity model).

alter table public.pos_orders
  add column if not exists fulfillment_asap boolean not null default true;

comment on column public.pos_orders.fulfillment_asap is
  'true = Schnellstmöglich (earliest after Mindestvorlauf); false = guest Wunschzeit in slot_start_at.';

comment on column public.pos_orders.slot_start_at is
  'Target ready/pickup/delivery time: earliest for ASAP, or guest-chosen Wunschzeit.';
