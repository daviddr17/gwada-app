-- WhatsApp Status als Story-Plattform (neben Facebook/Instagram Stories).
-- Feed-Publish bleibt auf whatsapp_channel; Status nur Stories-Cache.

alter table public.restaurant_news_stories_sync
  drop constraint if exists restaurant_news_stories_sync_platform_check;

alter table public.restaurant_news_stories_sync
  add constraint restaurant_news_stories_sync_platform_check
  check (platform in ('facebook', 'instagram', 'whatsapp_status'));

alter table public.restaurant_news_stories_cache
  drop constraint if exists restaurant_news_stories_cache_platform_check;

alter table public.restaurant_news_stories_cache
  add constraint restaurant_news_stories_cache_platform_check
  check (platform in ('facebook', 'instagram', 'whatsapp_status'));

-- Optional in Publications (falls Story-Post referenziert wird)
alter table public.gwada_news_publications
  drop constraint if exists gwada_news_publications_platform_check;

alter table public.gwada_news_publications
  add constraint gwada_news_publications_platform_check
  check (
    platform in (
      'gwada',
      'facebook',
      'instagram',
      'google_business',
      'whatsapp_channel',
      'whatsapp_status'
    )
  );
