-- Seed Stripe Price/Product IDs into platform_integrations (no secrets).
-- Secrets (secret_key, webhook_secret) remain Superadmin-only and are never committed.

update public.platform_integrations
set
  config = coalesce(config, '{}'::jsonb) || jsonb_build_object(
    'mode', coalesce(config->>'mode', 'live'),
    'price_basic_monthly', 'price_1Tyy7tIfiOyH4daYLgtr4VQx',
    'price_basic_yearly', 'price_1Tyy7tIfiOyH4daYNYz1yDVg',
    'price_pro_monthly', 'price_1Tyy7tIfiOyH4daYD4lonyOh',
    'price_pro_yearly', 'price_1Tyy7tIfiOyH4daYFxL0lZld',
    'price_pos_monthly', 'price_1Tyy7uIfiOyH4daYAxBswz08',
    'price_pos_yearly', 'price_1Tyy7uIfiOyH4daYURM8ZWUx',
    'product_basic', 'prod_Uyvz06BILSmU01',
    'product_pro', 'prod_UyvzQdoIL1rpk9',
    'product_pos', 'prod_UyvzmCDiwKNW1a',
    'webhook_endpoint_id', 'we_1Tyy83IfiOyH4daY4Fm6eiMb',
    'portal_configuration_id', 'bpc_1Tyy8GIfiOyH4daY7mgpQgEn'
  ),
  updated_at = now()
where key = 'stripe';
