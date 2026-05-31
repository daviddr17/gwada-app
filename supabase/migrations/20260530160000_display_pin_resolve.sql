-- Display-Login: Mitarbeiter nur per PIN auflösen (eindeutig pro Restaurant).

create or replace function public.resolve_restaurant_staff_by_display_pin(
  p_restaurant_id uuid,
  p_pin text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff record;
begin
  if p_pin is null or p_pin !~ '^[0-9]{4}$' then
    return null;
  end if;

  for v_staff in
    select id, display_pin_hash
    from public.restaurant_staff
    where restaurant_id = p_restaurant_id
      and is_active
      and display_pin_hash is not null
  loop
    if extensions.crypt(p_pin, v_staff.display_pin_hash) = v_staff.display_pin_hash then
      return v_staff.id;
    end if;
  end loop;

  return null;
end;
$$;

comment on function public.resolve_restaurant_staff_by_display_pin is
  'Findet Mitarbeiter anhand der 4-stelligen Display-PIN im Restaurant.';

revoke all on function public.resolve_restaurant_staff_by_display_pin(uuid, text) from public;
grant execute on function public.resolve_restaurant_staff_by_display_pin(uuid, text) to service_role;
