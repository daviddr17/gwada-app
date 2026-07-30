-- E-Mail: Status „outlook“ (Microsoft 365 OAuth) + Plattform-Client microsoft_oauth.

insert into public.platform_integrations (key, enabled, config)
values ('microsoft_oauth', false, '{}'::jsonb)
on conflict (key) do nothing;

alter table public.restaurant_integrations
  drop constraint if exists restaurant_integrations_status_check;

alter table public.restaurant_integrations
  add constraint restaurant_integrations_status_check
  check (
    (
      integration_key = 'whatsapp'
      and status in (
        'disconnected',
        'starting',
        'scan_qr',
        'working',
        'failed',
        'stopped'
      )
    )
    or (
      integration_key = 'email'
      and status in ('default', 'custom', 'gmail', 'outlook')
    )
    or (
      integration_key in (
        'facebook',
        'instagram',
        'google_business',
        'lexoffice',
        'tripadvisor',
        'apple_business_connect'
      )
      and status in ('disconnected', 'working')
    )
  );
