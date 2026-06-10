-- Lexware-Belege: updatedDate merken — Detail-API nur bei Änderung

alter table public.accounting_vouchers
  add column if not exists external_updated_at timestamptz;

comment on column public.accounting_vouchers.external_updated_at is
  'Lexware voucherlist updatedDate — steuert inkrementellen Detail-Abruf beim Sync.';
