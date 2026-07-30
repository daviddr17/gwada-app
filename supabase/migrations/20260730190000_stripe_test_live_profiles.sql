-- Stripe: Live-Price-IDs unter config.live spiegeln; ohne Secret → mode=test (Dev-Sandbox).

update public.platform_integrations
set
  config = (
    coalesce(config, '{}'::jsonb)
    || jsonb_build_object(
      'live',
      coalesce(config->'live', '{}'::jsonb)
        || jsonb_strip_nulls(
          jsonb_build_object(
            'price_basic_monthly', nullif(config->>'price_basic_monthly', ''),
            'price_basic_yearly', nullif(config->>'price_basic_yearly', ''),
            'price_pro_monthly', nullif(config->>'price_pro_monthly', ''),
            'price_pro_yearly', nullif(config->>'price_pro_yearly', ''),
            'price_pos_monthly', nullif(config->>'price_pos_monthly', ''),
            'price_pos_yearly', nullif(config->>'price_pos_yearly', ''),
            'product_basic', nullif(config->>'product_basic', ''),
            'product_pro', nullif(config->>'product_pro', ''),
            'product_pos', nullif(config->>'product_pos', ''),
            'webhook_endpoint_id', nullif(config->>'webhook_endpoint_id', ''),
            'portal_configuration_id', nullif(config->>'portal_configuration_id', ''),
            'secret_key', nullif(config->>'secret_key', ''),
            'webhook_secret', nullif(config->>'webhook_secret', ''),
            'publishable_key', nullif(config->>'publishable_key', '')
          )
        ),
      'test', coalesce(config->'test', '{}'::jsonb),
      'mode',
      case
        when nullif(trim(coalesce(config->>'secret_key', '')), '') is null
          then 'test'
        when config->>'secret_key' like 'sk_test%'
          or config->>'secret_key' like 'rk_test%'
          then 'test'
        else coalesce(nullif(config->>'mode', ''), 'live')
      end
    )
  ),
  updated_at = now()
where key = 'stripe';

-- Wenn mode=test und noch kein Test-Secret: Flat-Live-Prices aus dem aktiven Flat entfernen,
-- damit Checkout nicht versehentlich Live-Price-IDs mit Test-Keys mischt.
update public.platform_integrations
set
  config = config
    - 'price_basic_monthly'
    - 'price_basic_yearly'
    - 'price_pro_monthly'
    - 'price_pro_yearly'
    - 'price_pos_monthly'
    - 'price_pos_yearly'
    - 'product_basic'
    - 'product_pro'
    - 'product_pos'
    - 'webhook_endpoint_id'
    - 'portal_configuration_id'
    - 'secret_key'
    - 'webhook_secret'
    - 'publishable_key',
  updated_at = now()
where key = 'stripe'
  and config->>'mode' = 'test'
  and nullif(trim(coalesce(config->'test'->>'secret_key', '')), '') is null;
