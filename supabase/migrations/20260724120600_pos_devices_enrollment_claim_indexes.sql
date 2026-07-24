-- Unique enrollment code hash for public redeem lookup; device token lookup.
create unique index if not exists pos_devices_enrollment_code_hash_uidx
  on public.pos_devices (enrollment_code_hash)
  where enrollment_code_hash is not null;

create index if not exists pos_devices_token_hash_idx
  on public.pos_devices (device_token_hash)
  where device_token_hash is not null;

comment on column public.pos_devices.enrollment_code_hash is
  'SHA-256 hex of uppercase enrollment code; cleared after claim.';
comment on column public.pos_devices.device_token_hash is
  'SHA-256 hex of device bearer token; set on successful enroll claim.';
