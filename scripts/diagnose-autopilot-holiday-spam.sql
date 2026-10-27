-- Read-only: Autopilot Feiertags-Spam (pending/needs_asset) — Fokus zurschlagd + Überblick
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
  min(s.created_at) AS oldest,
  max(s.created_at) AS newest
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd'
  AND s.status IN ('pending', 'needs_asset')
GROUP BY s.slot_kind, s.status
ORDER BY n DESC, s.slot_kind, s.status;

\echo ''
\echo '=== zurschlagd: holiday titles (top) ==='
SELECT
  coalesce(nullif(s.title, ''), s.source_json->>'holidayName', '(ohne Titel)') AS title,
  coalesce(nullif(s.source_json->>'date', ''), to_char(s.planned_at AT TIME ZONE 'Europe/Berlin', 'YYYY-MM-DD')) AS holiday_date,
  count(*) AS n
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE r.slug = 'zurschlagd'
  AND s.status IN ('pending', 'needs_asset')
  AND s.slot_kind = 'holiday'
GROUP BY 1, 2
ORDER BY n DESC
LIMIT 30;

\echo ''
\echo '=== all restaurants: open holiday spam (>=3) ==='
SELECT
  r.slug,
  r.name,
  count(*) AS open_holidays,
  count(*) FILTER (
    WHERE coalesce(s.title, '') ILIKE '%himmelfahrt%'
       OR coalesce(s.source_json->>'holidayName', '') ILIKE '%himmelfahrt%'
  ) AS himmelfahrt_n
FROM public.social_post_suggestions s
JOIN public.restaurants r ON r.id = s.restaurant_id
WHERE s.status IN ('pending', 'needs_asset')
  AND s.slot_kind = 'holiday'
GROUP BY r.slug, r.name
HAVING count(*) >= 3
ORDER BY open_holidays DESC
LIMIT 40;

\echo ''
\echo '=== prune candidates (past date OR duplicate same date) ==='
WITH open_h AS (
  SELECT
    s.id,
    s.restaurant_id,
    r.slug,
    coalesce(
      nullif(s.source_json->>'date', '')::date,
      (s.planned_at AT TIME ZONE 'Europe/Berlin')::date
    ) AS holiday_date,
    s.created_at
  FROM public.social_post_suggestions s
  JOIN public.restaurants r ON r.id = s.restaurant_id
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
)
SELECT
  count(*) FILTER (
    WHERE holiday_date IS NULL
       OR holiday_date < (SELECT d FROM today)
       OR holiday_date > (SELECT d FROM today) + 5
  ) AS stale_or_far,
  count(*) FILTER (
    WHERE holiday_date IS NOT NULL
      AND holiday_date >= (SELECT d FROM today)
      AND holiday_date <= (SELECT d FROM today) + 5
      AND rn > 1
  ) AS duplicate_extra,
  count(*) FILTER (
    WHERE slug = 'zurschlagd'
      AND (
        holiday_date IS NULL
        OR holiday_date < (SELECT d FROM today)
        OR holiday_date > (SELECT d FROM today) + 5
        OR (
          holiday_date >= (SELECT d FROM today)
          AND holiday_date <= (SELECT d FROM today) + 5
          AND rn > 1
        )
      )
  ) AS zurschlagd_skip_candidates,
  count(*) FILTER (
    WHERE holiday_date IS NULL
       OR holiday_date < (SELECT d FROM today)
       OR holiday_date > (SELECT d FROM today) + 5
       OR (
         holiday_date >= (SELECT d FROM today)
         AND holiday_date <= (SELECT d FROM today) + 5
         AND rn > 1
       )
  ) AS all_skip_candidates
FROM ranked;
