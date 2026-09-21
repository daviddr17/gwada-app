-- Öffnungszeiten atomar ersetzen (DELETE + INSERT in einer Transaktion).
-- Der bisherige Client-Pfad insert-first kollidiert mit den Unique-Indexes
-- (weekly per day/role, exception closed/open), sobald schon Zeilen existieren.
-- Additive: nur Function; keine Datenänderung.

create or replace function public.replace_opening_hours(
  p_restaurant_id uuid,
  p_rows jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  row_json jsonb;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtext('opening_hours:' || p_restaurant_id::text)::bigint);

  delete from public.opening_hours
  where restaurant_id = p_restaurant_id;

  for row_json in
    select * from jsonb_array_elements(coalesce(p_rows, '[]'::jsonb))
  loop
    insert into public.opening_hours (
      restaurant_id,
      kind,
      weekday,
      exception_date,
      closed,
      opens_at,
      closes_at,
      note,
      schedule_role
    ) values (
      p_restaurant_id,
      row_json->>'kind',
      nullif(row_json->>'weekday', ''),
      case
        when nullif(row_json->>'exception_date', '') is null then null
        else (row_json->>'exception_date')::date
      end,
      coalesce((row_json->>'closed')::boolean, false),
      case
        when nullif(row_json->>'opens_at', '') is null then null
        else (row_json->>'opens_at')::time
      end,
      case
        when nullif(row_json->>'closes_at', '') is null then null
        else (row_json->>'closes_at')::time
      end,
      nullif(row_json->>'note', ''),
      coalesce(nullif(row_json->>'schedule_role', ''), 'business')
    );
  end loop;
end;
$$;

revoke all on function public.replace_opening_hours(uuid, jsonb) from public;
grant execute on function public.replace_opening_hours(uuid, jsonb)
  to anon, authenticated, service_role;

comment on function public.replace_opening_hours(uuid, jsonb) is
  'Ersetzt alle opening_hours eines Restaurants atomar (DELETE dann INSERT). Staff oder service_role.';
