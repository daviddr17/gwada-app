alter table public.pos_register_sessions
  add column if not exists dsfinvk_business_date date;

comment on column public.pos_register_sessions.dsfinvk_business_date is
  'Geschäftstag (YYYY-MM-DD, Europe/Berlin) — gleicher Wert in Fiskaly closing head und Export-Filter.';
