-- Demo-Tischplan für Restaurant slug gwada-demo (lokal nach seed.sql).
-- Bereich „Innenraum“ + Tische 1–8 für Staff-App / Reservierungen.

do $$
declare
  v_restaurant_id uuid;
  v_area_id uuid;
begin
  select id into v_restaurant_id
  from public.restaurants
  where slug = 'gwada-demo'
  limit 1;

  if v_restaurant_id is null then
    raise notice 'seed_dining_floor_demo: no gwada-demo restaurant, skip';
    return;
  end if;

  select id into v_area_id
  from public.dining_areas
  where restaurant_id = v_restaurant_id
    and lower(name) = lower('Innenraum')
  limit 1;

  if v_area_id is null then
    insert into public.dining_areas (
      restaurant_id,
      name,
      sort_order,
      display_number,
      color_hex
    )
    values (v_restaurant_id, 'Innenraum', 0, 1, '#64748b')
    returning id into v_area_id;
  end if;

  insert into public.dining_tables (
    restaurant_id,
    area_id,
    table_number,
    table_name,
    capacity,
    sort_order,
    is_active,
    plan_x_pct,
    plan_y_pct
  )
  select
    v_restaurant_id,
    v_area_id,
    n.num,
    'Tisch ' || n.num,
    4,
    n.num,
    true,
    10 + ((n.num - 1) % 4) * 22,
    12 + ((n.num - 1) / 4) * 28
  from generate_series(1, 8) as n(num)
  where not exists (
    select 1
    from public.dining_tables dt
    where dt.restaurant_id = v_restaurant_id
      and dt.area_id = v_area_id
      and dt.table_number = n.num
  );

  raise notice 'seed_dining_floor_demo: dining floor ready for gwada-demo';
end $$;
