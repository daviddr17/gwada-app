-- Realtime für Glocke (notification_events) und Feed-Sync-Status (News/Bewertungen).

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notification_events;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_news_platform_sync;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_reviews_platform_sync;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
