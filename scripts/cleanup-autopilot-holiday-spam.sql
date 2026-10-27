-- Soft-skip: stale/far/duplicate open holiday drafts → status skipped (kein Hard-Delete)
-- Scope: alle Restaurants (inkl. zurschlagd Maria-Himmelfahrt-Spam)

\pset pager off

\echo '=== BEFORE counts ==='
SELECT
  count(*) FILTER (WHERE s.status IN ('pending', 'needs_asset') AND s.slot_kind = 'holiday') AS open_holidays,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset')
      AND s.slot_kind = 'holiday'
      AND r.slug = 'zurschlagd'
  ) AS zurschlagd_open_holidays,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset')
      AND s.slot_kind = 'holiday'
      AND (
        coalesce(s.title, '') ILIKE '%himmelfahrt%'
        OR coalesce(s.source_json->>'holidayName', '') ILIKE '%himmelfahrt%'
      )
  ) AS open_himmelfahrt
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id;

WITH open_h AS (
  SELECT
    s.id,
    s.restaurant_id,
    coalesce(
      nullif(s.source_json->>'date', '')::date,
      (s.planned_at AT TIME ZONE 'Europe/Berlin')::date
    ) AS holiday_date,
    s.created_at
  FROM public.social_post_suggestions s
  WHERE s.status IN ('pending', 'needs_asset')
    AND s.slot_kind = 'holiday'
),
today AS (
  SELECT (timezone('Europe/Berlin', now()))::date AS d
),
ranked AS (
  SELECT
    o.*,
    row_number() OVER (
      PARTITION BY o.restaurant_id, o.holiday_date
      ORDER BY o.created_at DESC NULLS LAST, o.id DESC
    ) AS rn
  FROM open_h o
),
to_skip AS (
  SELECT id
  FROM ranked
  WHERE holiday_date IS NULL
     OR holiday_date < (SELECT d FROM today)
     OR holiday_date > (SELECT d FROM today) + 5
     OR (
       holiday_date >= (SELECT d FROM today)
       AND holiday_date <= (SELECT d FROM today) + 5
       AND rn > 1
     )
)
UPDATE public.social_post_suggestions s
SET status = 'skipped'
FROM to_skip t
WHERE s.id = t.id
  AND s.status IN ('pending', 'needs_asset')
RETURNING s.id, s.restaurant_id, s.title, s.source_json->>'date' AS holiday_date;

\echo '=== AFTER counts ==='
SELECT
  count(*) FILTER (WHERE s.status IN ('pending', 'needs_asset') AND s.slot_kind = 'holiday') AS open_holidays,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset')
      AND s.slot_kind = 'holiday'
      AND r.slug = 'zurschlagd'
  ) AS zurschlagd_open_holidays,
  count(*) FILTER (
    WHERE s.status IN ('pending', 'needs_asset')
      AND s.slot_kind = 'holiday'
      AND (
        coalesce(s.title, '') ILIKE '%himmelfahrt%'
        OR coalesce(s.source_json->>'holidayName', '') ILIKE '%himmelfahrt%'
      )
  ) AS open_himmelfahrt,
  count(*) FILTER (
    WHERE s.status = 'skipped'
      AND s.slot_kind = 'holiday'
      AND r.slug = 'zurschlagd'
      AND s.updated_at > timezone('utc', now()) - interval '5 minutes'
  ) AS zurschlagd_skipped_last_5m
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id;
