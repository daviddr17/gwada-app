-- Entfernt inaktive Gerichte für Restaurant zurschlagd und nummeriert aktive pro Kategorie 1…n.
\set ON_ERROR_STOP on

BEGIN;

DO $$
DECLARE
  v_restaurant_id uuid;
  v_inactive_count integer;
  v_active_count integer;
  v_negative_count integer;
BEGIN
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE slug = 'zurschlagd'
  LIMIT 1;

  IF v_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'Restaurant slug zurschlagd nicht gefunden';
  END IF;

  SELECT count(*) INTO v_inactive_count
  FROM public.menu_items
  WHERE restaurant_id = v_restaurant_id
    AND is_active = false;

  SELECT count(*) INTO v_active_count
  FROM public.menu_items
  WHERE restaurant_id = v_restaurant_id
    AND is_active = true;

  SELECT count(*) INTO v_negative_count
  FROM public.menu_items
  WHERE restaurant_id = v_restaurant_id
    AND is_active = true
    AND list_number IS NOT NULL
    AND list_number < 1;

  RAISE NOTICE 'zurschlagd (%): % inaktive, % aktive Gerichte, % mit negativer Nummer (vorher)',
    v_restaurant_id, v_inactive_count, v_active_count, v_negative_count;
END $$;

DELETE FROM public.menu_items mi
USING public.restaurants r
WHERE r.slug = 'zurschlagd'
  AND mi.restaurant_id = r.id
  AND mi.is_active = false;

WITH ranked AS (
  SELECT
    mi.id,
    row_number() OVER (
      PARTITION BY mi.category_id
      ORDER BY
        mi.list_number NULLS LAST,
        lower(mi.name)
    ) AS new_list_number
  FROM public.menu_items mi
  JOIN public.restaurants r ON r.id = mi.restaurant_id
  WHERE r.slug = 'zurschlagd'
    AND mi.is_active = true
)
UPDATE public.menu_items mi
SET list_number = ranked.new_list_number
FROM ranked
WHERE mi.id = ranked.id;

DO $$
DECLARE
  v_restaurant_id uuid;
  v_active_count integer;
  v_min_num integer;
  v_max_num integer;
BEGIN
  SELECT id INTO v_restaurant_id
  FROM public.restaurants
  WHERE slug = 'zurschlagd'
  LIMIT 1;

  SELECT count(*), min(list_number), max(list_number)
  INTO v_active_count, v_min_num, v_max_num
  FROM public.menu_items
  WHERE restaurant_id = v_restaurant_id
    AND is_active = true;

  RAISE NOTICE 'Nachher: % aktive Gerichte, list_number min=%, max=%',
    v_active_count, v_min_num, v_max_num;
END $$;

COMMIT;
