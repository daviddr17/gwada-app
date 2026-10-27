-- Soft-skip: offene Speisekarten-/Ambiente-Drafts bei zurschlagd → status skipped
-- (nie als News-Post erstellt; kein Hard-Delete). Idempotent.

\pset pager off

\echo '=== BEFORE counts (zurschlagd) ==='
SELECT
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset') AND s.slot_kind = 'menu_dish'
  ) AS open_menu_dish,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset') AND s.slot_kind = 'ambient'
  ) AS open_ambient,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset')
      AND s.slot_kind IN ('menu_dish', 'ambient')
      AND s.news_post_id IS NULL
  ) AS open_menu_like_without_post,
  count(*) FILTER (WHERE s.status IN ('pending', 'needs_asset')) AS open_all
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd';

WITH to_skip AS (
  SELECT s.id
  FROM public.social_post_suggestions s
  JOIN public.restaurants r ON r.id = s.restaurant_id
  WHERE r.slug = 'zurschlagd'
    AND s.status IN ('pending', 'needs_asset')
    AND s.slot_kind IN ('menu_dish', 'ambient')
    AND s.news_post_id IS NULL
),
upd AS (
  UPDATE public.social_post_suggestions s
  SET status = 'skipped'
  FROM to_skip t
  WHERE s.id = t.id
    AND s.status IN ('pending', 'needs_asset')
  RETURNING s.id, s.slot_kind
)
SELECT
  count(*) AS updated_rows,
  count(*) FILTER (WHERE slot_kind = 'menu_dish') AS updated_menu_dish,
  count(*) FILTER (WHERE slot_kind = 'ambient') AS updated_ambient
FROM upd;

\echo '=== AFTER counts (zurschlagd) ==='
SELECT
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset') AND s.slot_kind = 'menu_dish'
  ) AS open_menu_dish,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset') AND s.slot_kind = 'ambient'
  ) AS open_ambient,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset')
      AND s.slot_kind IN ('menu_dish', 'ambient')
      AND s.news_post_id IS NULL
  ) AS open_menu_like_without_post,
  count(*) FILTER (WHERE s.status IN ('pending', 'needs_asset')) AS open_all,
  count(*) FILTER (
    WHERE s.status = 'skipped'
      AND s.slot_kind IN ('menu_dish', 'ambient')
      AND s.updated_at > timezone('utc', now()) - interval '5 minutes'
  ) AS skipped_last_5m
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd';
