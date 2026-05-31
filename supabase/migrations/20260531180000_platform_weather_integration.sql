-- Visual Crossing Wetter-API (Superadmin, plattformweit).

insert into public.platform_integrations (key, enabled, config)
values ('weather', false, '{}'::jsonb)
on conflict (key) do nothing;
