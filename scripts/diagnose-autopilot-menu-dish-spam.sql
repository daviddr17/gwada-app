-- Read-only: Autopilot Speisekarten-/ähnliche Spam-Drafts — Fokus zurschlagd
\pset pager off

SELECT r.slug, r.name, r.id AS restaurant_id
FROM public.restaurants r
WHERE r.slug = 'zurschlagd' OR lower(r.name) LIKE '%schlagd%'
ORDER BY r.slug;

\echo ''
\echo '=== zurschlagd: open suggestions by slot_kind ==='
SELECT
  s.slot_kind,
  s.status,
  count(*) AS n,
  count(*) FILTER (WHERE s.news_post_id IS NULL) AS without_post,
  min(s.created_at) AS oldest,
  max(s.created_at) AS newest
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd'
  AND s.status IN ('pending', 'needs_asset')
GROUP BY s.slot_kind, s.status
ORDER BY n DESC, s.slot_kind, s.status;

\echo ''
\echo '=== zurschlagd: open menu_dish / ambient sample titles ==='
SELECT
  s.slot_kind,
  coalesce(nullif(s.title, ''), s.source_json->>'dishName', s.source_json->>'label', '(ohne Titel)') AS title,
  count(*) AS n
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd'
  AND s.status IN ('pending', 'needs_asset')
  AND s.slot_kind IN ('menu_dish', 'ambient')
GROUP BY 1, 2
ORDER BY n DESC
LIMIT 40;

\echo ''
\echo '=== all restaurants: open menu_dish spam (>=10) ==='
SELECT
  r.slug,
  r.name,
  count(*) AS open_menu_dish,
  count(*) FILTER (WHERE s.news_post_id IS NULL) AS without_post
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE s.status IN ('pending', 'needs_asset')
  AND s.slot_kind = 'menu_dish'
GROUP BY r.slug, r.name
HAVING count(*) >= 10
ORDER BY open_menu_dish DESC
LIMIT 40;

\echo ''
\echo '=== skip candidates (zurschlagd open menu_dish|ambient, never posted) ==='
SELECT
  count(*) FILTER (WHERE s.slot_kind = 'menu_dish') AS menu_dish_candidates,
  count(*) FILTER (WHERE s.slot_kind = 'ambient') AS ambient_candidates,
  count(*) AS all_candidates
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd'
  AND s.status IN ('pending', 'needs_asset')
  AND s.slot_kind IN ('menu_dish', 'ambient')
  AND s.news_post_id IS NULL;
