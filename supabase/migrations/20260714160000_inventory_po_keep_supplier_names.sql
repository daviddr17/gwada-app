-- Beim Speichern von Bestellungen fehlende Lieferanten anlegen, aber
-- bestehende Taxonomy-Namen (Umbenennung unter Bestand → Lieferanten) nicht überschreiben.

create or replace function public.inventory_replace_purchase_orders(
  p_restaurant_id uuid,
  p_orders jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  ord jsonb;
  ln jsonb;
  lg jsonb;
  s int;
  dd date;
begin
  if coalesce(auth.role(), '') is distinct from 'service_role' then
    if not public.auth_is_restaurant_staff(p_restaurant_id) then
      raise exception 'not authorized for restaurant %', p_restaurant_id
        using errcode = '42501';
    end if;
  end if;

  delete from public.inventory_purchase_order_log_entries where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_order_lines where restaurant_id = p_restaurant_id;
  delete from public.inventory_purchase_orders where restaurant_id = p_restaurant_id;

  for ord in select * from jsonb_array_elements(coalesce(p_orders, '[]'::jsonb))
  loop
    if nullif(trim(ord->>'supplierId'), '') is not null then
      insert into public.inventory_suppliers (
        restaurant_id, id, name, sort_order, is_active
      ) values (
        p_restaurant_id,
        ord->>'supplierId',
        coalesce(nullif(trim(ord->>'supplierName'), ''), ord->>'supplierId'),
        0,
        true
      )
      on conflict (restaurant_id, id) do update
        set is_active = true;
        -- name bewusst nicht überschreiben (Taxonomie ist Source of Truth)
    end if;

    dd := null;
    if ord ? 'deliveryDate' and nullif(trim(ord->>'deliveryDate'), '') is not null then
      dd := (ord->>'deliveryDate')::date;
    end if;

    insert into public.inventory_purchase_orders (
      restaurant_id, id, supplier_id, supplier_name, status,
      created_at, created_by, created_by_user_source, delivery_date
    ) values (
      p_restaurant_id,
      ord->>'id',
      ord->>'supplierId',
      ord->>'supplierName',
      ord->>'status',
      coalesce((ord->>'createdAt')::timestamptz, timezone('utc', now())),
      coalesce(ord->>'createdBy', ''),
      nullif(ord->>'createdByUserSource', ''),
      dd
    );

    for ln in select * from jsonb_array_elements(coalesce(ord->'lines', '[]'::jsonb))
    loop
      insert into public.inventory_purchase_order_lines (
        restaurant_id, order_id, id, ingredient_id, ingredient_name, brand_label,
        quantity, unit_id, unit_label, delivered_at
      ) values (
        p_restaurant_id,
        ord->>'id',
        ln->>'id',
        ln->>'ingredientId',
        ln->>'ingredientName',
        nullif(ln->>'brandLabel', ''),
        (ln->>'quantity')::numeric,
        ln->>'unitId',
        ln->>'unitLabel',
        case
          when nullif(trim(ln->>'deliveredAt'), '') is null then null
          else (ln->>'deliveredAt')::timestamptz
        end
      );
    end loop;

    s := 0;
    for lg in select * from jsonb_array_elements(coalesce(ord->'log', '[]'::jsonb))
    loop
      insert into public.inventory_purchase_order_log_entries (restaurant_id, order_id, sort_order, entry)
      values (p_restaurant_id, ord->>'id', s, lg);
      s := s + 1;
    end loop;
  end loop;
end;
$$;
