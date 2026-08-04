#!/usr/bin/env bash
# Auf dem VPS: Speisekarte zurschlagd Live → Dev (nur Menü-Stammdaten).
# Restaurant-IDs werden remappt; Row-UUIDs bleiben (kein Cross-Tenant-Collision erwartet).
# Kein Live-Schreiben. Dev-Menü für zurschlagd wird ersetzt.
set -euo pipefail

SLUG="${GWADA_MENU_SYNC_SLUG:-zurschlagd}"
WORKDIR="${GWADA_MENU_SYNC_WORKDIR:-/tmp/gwada-menu-sync-$$}"
mkdir -p "${WORKDIR}"
cleanup() { rm -rf "${WORKDIR}"; }
trap cleanup EXIT

echo "=== Resolve DB containers ==="
LIVE_DB="$(docker ps --format '{{.Names}}' | grep -E 'supabase-db|supabase.*-db' | grep -v gwada-dev | head -1 || true)"
DEV_DB="$(docker ps --format '{{.Names}}' | grep -E '^gwada-dev-db$' | head -1 || true)"
if [[ -z "${LIVE_DB}" ]]; then
  LIVE_DB="$(docker ps --format '{{.Names}}' | grep -E 'db' | grep -i supabase | grep -v gwada-dev | head -1 || true)"
fi
if [[ -z "${DEV_DB}" ]]; then
  DEV_DB="$(docker ps --format '{{.Names}}' | grep gwada-dev | grep -E 'db$' | head -1 || true)"
fi
echo "LIVE_DB=${LIVE_DB}"
echo "DEV_DB=${DEV_DB}"
[[ -n "${LIVE_DB}" && -n "${DEV_DB}" ]] || { echo "FEHLER: Live/Dev DB-Container nicht gefunden"; docker ps --format '{{.Names}}'; exit 1; }

live_psql() { docker exec -i "${LIVE_DB}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }
dev_psql() { docker exec -i "${DEV_DB}" psql -U postgres -d postgres -v ON_ERROR_STOP=1 "$@"; }

LIVE_RID="$(live_psql -tAc "SELECT id::text FROM public.restaurants WHERE slug = '${SLUG}' LIMIT 1" | tr -d '[:space:]')"
DEV_RID="$(dev_psql -tAc "SELECT id::text FROM public.restaurants WHERE slug = '${SLUG}' LIMIT 1" | tr -d '[:space:]')"
echo "LIVE_RID=${LIVE_RID}"
echo "DEV_RID=${DEV_RID}"
[[ -n "${LIVE_RID}" && -n "${DEV_RID}" ]] || { echo "FEHLER: Restaurant ${SLUG} fehlt auf Live oder Dev"; exit 1; }

echo "=== Live counts ==="
live_psql -c "
SELECT
  (SELECT count(*) FROM menu_categories WHERE restaurant_id = '${LIVE_RID}'::uuid) AS cats,
  (SELECT count(*) FROM menu_items WHERE restaurant_id = '${LIVE_RID}'::uuid) AS items,
  (SELECT count(*) FROM menu_items WHERE restaurant_id = '${LIVE_RID}'::uuid AND COALESCE(is_active,true)) AS active_items,
  (SELECT count(*) FROM menu_item_side_config WHERE restaurant_id = '${LIVE_RID}'::uuid) AS side_configs,
  (SELECT count(*) FROM menu_option_groups WHERE restaurant_id = '${LIVE_RID}'::uuid) AS option_groups;
"

echo "=== Export Live → ${WORKDIR} ==="
# Generiert INSERT-SQL mit remapptem restaurant_id (DEV_RID). Row-PKs unverändert.
live_psql -At <<SQL > "${WORKDIR}/dump.sql"
-- main categories
SELECT format(
  'INSERT INTO public.menu_main_categories (id, restaurant_id, name, sort_order, is_active) VALUES (%L::uuid, %L::uuid, %L, %s, %L) ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;',
  id, '${DEV_RID}', name, sort_order, is_active
)
FROM public.menu_main_categories WHERE restaurant_id = '${LIVE_RID}'::uuid
ORDER BY sort_order, name;

-- categories (main_category_id optional)
SELECT format(
  'INSERT INTO public.menu_categories (id, restaurant_id, name, sort_order, is_active, main_category_id) VALUES (%L::uuid, %L::uuid, %L, %s, %L, %s) ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, name = EXCLUDED.name, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active, main_category_id = EXCLUDED.main_category_id;',
  id, '${DEV_RID}', name, sort_order, is_active,
  CASE WHEN main_category_id IS NULL THEN 'NULL' ELSE quote_literal(main_category_id::text) || '::uuid' END
)
FROM public.menu_categories WHERE restaurant_id = '${LIVE_RID}'::uuid
ORDER BY sort_order, name;

-- tags
SELECT format(
  'INSERT INTO public.menu_tags (id, restaurant_id, name, background_color, sort_order, is_active) VALUES (%L::uuid, %L::uuid, %L, %L, %s, %L) ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, name = EXCLUDED.name, background_color = EXCLUDED.background_color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;',
  id, '${DEV_RID}', name, background_color, sort_order, is_active
)
FROM public.menu_tags WHERE restaurant_id = '${LIVE_RID}'::uuid;

-- allergens
SELECT format(
  'INSERT INTO public.menu_allergens (id, restaurant_id, name, background_color, sort_order, is_active) VALUES (%L::uuid, %L::uuid, %L, %L, %s, %L) ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, name = EXCLUDED.name, background_color = EXCLUDED.background_color, sort_order = EXCLUDED.sort_order, is_active = EXCLUDED.is_active;',
  id, '${DEV_RID}', name, background_color, sort_order, is_active
)
FROM public.menu_allergens WHERE restaurant_id = '${LIVE_RID}'::uuid;

-- option groups
SELECT format(
  'INSERT INTO public.menu_option_groups (id, restaurant_id, name, is_active, sort_order, min_select, max_select) VALUES (%L::uuid, %L::uuid, %L, %L, %s, %s, %s) ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, name = EXCLUDED.name, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order, min_select = EXCLUDED.min_select, max_select = EXCLUDED.max_select;',
  id, '${DEV_RID}', name, is_active, sort_order, min_select,
  CASE WHEN max_select IS NULL THEN 'NULL' ELSE max_select::text END
)
FROM public.menu_option_groups WHERE restaurant_id = '${LIVE_RID}'::uuid
ORDER BY sort_order, name;

-- option choices
SELECT format(
  'INSERT INTO public.menu_option_choices (id, option_group_id, name, price_delta, is_active, sort_order) VALUES (%L::uuid, %L::uuid, %L, %s, %L, %s) ON CONFLICT (id) DO UPDATE SET option_group_id = EXCLUDED.option_group_id, name = EXCLUDED.name, price_delta = EXCLUDED.price_delta, is_active = EXCLUDED.is_active, sort_order = EXCLUDED.sort_order;',
  c.id, c.option_group_id, c.name, c.price_delta, c.is_active, c.sort_order
)
FROM public.menu_option_choices c
JOIN public.menu_option_groups g ON g.id = c.option_group_id
WHERE g.restaurant_id = '${LIVE_RID}'::uuid
ORDER BY c.sort_order, c.name;

-- items (core POS fields)
SELECT format(
  'INSERT INTO public.menu_items (id, restaurant_id, category_id, name, description, price, image_url, is_active, list_number, vat_rate, side_price_cents) VALUES (%L::uuid, %L::uuid, %L::uuid, %L, %L, %s, %L, %L, %s, %s, %s) ON CONFLICT (id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description, price = EXCLUDED.price, image_url = EXCLUDED.image_url, is_active = EXCLUDED.is_active, list_number = EXCLUDED.list_number, vat_rate = EXCLUDED.vat_rate, side_price_cents = EXCLUDED.side_price_cents;',
  id, '${DEV_RID}', category_id, name, coalesce(description,''), price,
  coalesce(image_url,''), is_active,
  CASE WHEN list_number IS NULL THEN 'NULL' ELSE list_number::text END,
  coalesce(vat_rate, 19),
  CASE WHEN side_price_cents IS NULL THEN 'NULL' ELSE side_price_cents::text END
)
FROM public.menu_items WHERE restaurant_id = '${LIVE_RID}'::uuid
ORDER BY list_number NULLS LAST, name;

-- item ↔ option groups
SELECT format(
  'INSERT INTO public.menu_item_option_groups (menu_item_id, option_group_id, sort_order) VALUES (%L::uuid, %L::uuid, %s) ON CONFLICT (menu_item_id, option_group_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;',
  iog.menu_item_id, iog.option_group_id, iog.sort_order
)
FROM public.menu_item_option_groups iog
JOIN public.menu_items mi ON mi.id = iog.menu_item_id
WHERE mi.restaurant_id = '${LIVE_RID}'::uuid;

-- side config
SELECT format(
  'INSERT INTO public.menu_item_side_config (menu_item_id, restaurant_id, required, max_sides, included_count) VALUES (%L::uuid, %L::uuid, %L, %s, %s) ON CONFLICT (menu_item_id) DO UPDATE SET restaurant_id = EXCLUDED.restaurant_id, required = EXCLUDED.required, max_sides = EXCLUDED.max_sides, included_count = EXCLUDED.included_count;',
  menu_item_id, '${DEV_RID}', required, max_sides, included_count
)
FROM public.menu_item_side_config WHERE restaurant_id = '${LIVE_RID}'::uuid;

-- recipe lines
SELECT format(
  'INSERT INTO public.menu_item_recipe_lines (menu_item_id, ingredient_id, amount, sort_order) VALUES (%L::uuid, %L, %s, %s) ON CONFLICT (menu_item_id, ingredient_id) DO UPDATE SET amount = EXCLUDED.amount, sort_order = EXCLUDED.sort_order;',
  rl.menu_item_id, rl.ingredient_id, rl.amount, rl.sort_order
)
FROM public.menu_item_recipe_lines rl
JOIN public.menu_items mi ON mi.id = rl.menu_item_id
WHERE mi.restaurant_id = '${LIVE_RID}'::uuid
ORDER BY rl.sort_order;

-- item tags
SELECT format(
  'INSERT INTO public.menu_item_tags (menu_item_id, tag_id) VALUES (%L::uuid, %L::uuid) ON CONFLICT DO NOTHING;',
  it.menu_item_id, it.tag_id
)
FROM public.menu_item_tags it
JOIN public.menu_items mi ON mi.id = it.menu_item_id
WHERE mi.restaurant_id = '${LIVE_RID}'::uuid;

-- item allergens
SELECT format(
  'INSERT INTO public.menu_item_allergens (menu_item_id, allergen_id) VALUES (%L::uuid, %L::uuid) ON CONFLICT DO NOTHING;',
  ia.menu_item_id, ia.allergen_id
)
FROM public.menu_item_allergens ia
JOIN public.menu_items mi ON mi.id = ia.menu_item_id
WHERE mi.restaurant_id = '${LIVE_RID}'::uuid;
SQL

LINES="$(wc -l < "${WORKDIR}/dump.sql" | tr -d ' ')"
echo "Generated ${LINES} SQL statements"

echo "=== Wipe Dev menu for ${SLUG} ==="
dev_psql <<SQL
BEGIN;
DELETE FROM public.menu_item_recipe_lines
 WHERE menu_item_id IN (SELECT id FROM public.menu_items WHERE restaurant_id = '${DEV_RID}'::uuid);
DELETE FROM public.menu_item_option_groups
 WHERE menu_item_id IN (SELECT id FROM public.menu_items WHERE restaurant_id = '${DEV_RID}'::uuid);
DELETE FROM public.menu_item_tags
 WHERE menu_item_id IN (SELECT id FROM public.menu_items WHERE restaurant_id = '${DEV_RID}'::uuid);
DELETE FROM public.menu_item_allergens
 WHERE menu_item_id IN (SELECT id FROM public.menu_items WHERE restaurant_id = '${DEV_RID}'::uuid);
DELETE FROM public.menu_item_side_config WHERE restaurant_id = '${DEV_RID}'::uuid;
DELETE FROM public.menu_option_choices
 WHERE option_group_id IN (SELECT id FROM public.menu_option_groups WHERE restaurant_id = '${DEV_RID}'::uuid);
DELETE FROM public.menu_option_groups WHERE restaurant_id = '${DEV_RID}'::uuid;
DELETE FROM public.menu_items WHERE restaurant_id = '${DEV_RID}'::uuid;
DELETE FROM public.menu_categories WHERE restaurant_id = '${DEV_RID}'::uuid;
DELETE FROM public.menu_tags WHERE restaurant_id = '${DEV_RID}'::uuid;
DELETE FROM public.menu_allergens WHERE restaurant_id = '${DEV_RID}'::uuid;
DELETE FROM public.menu_main_categories WHERE restaurant_id = '${DEV_RID}'::uuid;
COMMIT;
SQL

echo "=== Apply dump to Dev ==="
# Prefix transaction
{
  echo "BEGIN;"
  cat "${WORKDIR}/dump.sql"
  echo "COMMIT;"
} | dev_psql

echo "=== Dev counts after ==="
dev_psql -c "
SELECT
  (SELECT count(*) FROM menu_categories WHERE restaurant_id = '${DEV_RID}'::uuid) AS cats,
  (SELECT count(*) FROM menu_items WHERE restaurant_id = '${DEV_RID}'::uuid) AS items,
  (SELECT count(*) FROM menu_items WHERE restaurant_id = '${DEV_RID}'::uuid AND COALESCE(is_active,true)) AS active_items,
  (SELECT count(*) FROM menu_item_side_config WHERE restaurant_id = '${DEV_RID}'::uuid) AS side_configs,
  (SELECT count(*) FROM menu_option_groups WHERE restaurant_id = '${DEV_RID}'::uuid) AS option_groups,
  (SELECT count(*) FROM menu_item_recipe_lines rl
     JOIN menu_items mi ON mi.id = rl.menu_item_id
    WHERE mi.restaurant_id = '${DEV_RID}'::uuid) AS recipe_lines;
"

echo "=== Sample active items ==="
dev_psql -c "
SELECT mi.name, mc.name AS cat
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
WHERE mi.restaurant_id = '${DEV_RID}'::uuid AND COALESCE(mi.is_active,true)
ORDER BY mc.sort_order, mi.list_number NULLS LAST, mi.name
LIMIT 20;
"

# Reload PostgREST schema cache (best-effort)
dev_psql -c "NOTIFY pgrst, 'reload schema';" || true

echo "✓ Live → Dev Speisekarte sync fertig (${SLUG})"
