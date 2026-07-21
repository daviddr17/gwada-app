-- Social Autopilot: Stories (IG/FB) + Speichern der Story-Kanäle an News-Posts

alter table public.restaurant_social_brand_kit
  add column if not exists publish_stories boolean not null default true;

alter table public.gwada_news_posts
  add column if not exists story_platforms text[] not null default '{}'::text[];

comment on column public.restaurant_social_brand_kit.publish_stories is
  'Autopilot: zusätzlich Instagram-/Facebook-Story posten, wenn Kanal verbunden.';

comment on column public.gwada_news_posts.story_platforms is
  'Story-Zielkanäle (facebook/instagram); bei scheduled Posts nach Publish ausführen.';
