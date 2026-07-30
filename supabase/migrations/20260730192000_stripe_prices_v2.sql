-- Stripe Live Price-IDs v2 (Basic 49/39, Pro 99/79, POS 59/47 € Monatsäquivalent).

update public.platform_integrations
set
  config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'price_basic_monthly', 'price_1TyyYeIfiOyH4daYy1fmBMUu',
    'price_basic_yearly', 'price_1TyyYeIfiOyH4daYjyt756uZ',
    'price_pro_monthly', 'price_1TyyYfIfiOyH4daYxvUoU6Ih',
    'price_pro_yearly', 'price_1TyyYfIfiOyH4daYQacQKF1t',
    'price_pos_monthly', 'price_1TyyYfIfiOyH4daYq5ExvjUT',
    'price_pos_yearly', 'price_1TyyYfIfiOyH4daYKSLELqlk',
    'catalog_version', '2026-07-v2'
  )
  || jsonb_build_object(
    'live',
    coalesce(config->'live', '{}'::jsonb) || jsonb_build_object(
      'price_basic_monthly', 'price_1TyyYeIfiOyH4daYy1fmBMUu',
      'price_basic_yearly', 'price_1TyyYeIfiOyH4daYjyt756uZ',
      'price_pro_monthly', 'price_1TyyYfIfiOyH4daYxvUoU6Ih',
      'price_pro_yearly', 'price_1TyyYfIfiOyH4daYQacQKF1t',
      'price_pos_monthly', 'price_1TyyYfIfiOyH4daYq5ExvjUT',
      'price_pos_yearly', 'price_1TyyYfIfiOyH4daYKSLELqlk',
      'catalog_version', '2026-07-v2'
    )
  ),
  updated_at = now()
where key = 'stripe';
