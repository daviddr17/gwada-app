-- Social Autopilot: Ziel-Plattformen im Brand Kit (News-Kanäle)

alter table public.restaurant_social_brand_kit
  add column if not exists publish_platforms text[] not null
    default array[
      'gwada',
      'facebook',
      'instagram',
      'google_business',
      'whatsapp_channel'
    ]::text[];

comment on column public.restaurant_social_brand_kit.publish_platforms is
  'Zielkanäle für Autopilot-Posts (News-Platforms); zur Publish-Zeit auf verbundene Kanäle gefiltert.';
