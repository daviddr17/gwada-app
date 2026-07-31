-- pos_display_pin_offline_hash nutzte Text mit chr(0); convert_to/digest
-- wirft damit „null character not permitted“ → Display-PIN speichern bricht ab.
-- Bytea mit explizitem NUL-Byte statt Text-Konkatenation (parität zu Node crypto).

create or replace function public.pos_display_pin_offline_hash(
  p_pin text,
  p_restaurant_id uuid
)
returns text
language sql
immutable
as $$
  select encode(
    extensions.digest(
      convert_to(p_pin, 'utf8')
        || '\x00'::bytea
        || convert_to(p_restaurant_id::text, 'utf8')
        || '\x00'::bytea
        || convert_to('gwada-pos-offline-v1', 'utf8'),
      'sha256'
    ),
    'hex'
  );
$$;

revoke all on function public.pos_display_pin_offline_hash(text, uuid) from public;
grant execute on function public.pos_display_pin_offline_hash(text, uuid) to service_role;

comment on function public.pos_display_pin_offline_hash(text, uuid) is
  'SHA-256 hex von UTF-8(pin)||0x00||UTF-8(restaurant_id)||0x00||UTF-8(gwada-pos-offline-v1); muss Node posDisplayPinOfflineHash entsprechen.';
