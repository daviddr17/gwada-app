-- Chip „Alle“ in Profil & Embed optional ausblenden (nur Einzelplattformen).

alter table public.restaurant_news_settings
  add column if not exists embed_show_all_filter boolean not null default true;

comment on column public.restaurant_news_settings.embed_show_all_filter is
  'Wenn false: kein Chip „Alle“ — Gäste sehen nur gefilterte Einzelplattformen.';
