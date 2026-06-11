-- Mehrere WhatsApp-Kanäle (OWNER) für News lesen/posten

alter table public.restaurant_news_settings
  add column if not exists whatsapp_channel_ids text[] not null default '{}';

update public.restaurant_news_settings
set whatsapp_channel_ids = array[whatsapp_channel_id]::text[]
where whatsapp_channel_id is not null
  and trim(whatsapp_channel_id) <> ''
  and coalesce(array_length(whatsapp_channel_ids, 1), 0) = 0;
