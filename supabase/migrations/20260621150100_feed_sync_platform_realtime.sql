-- Realtime für Feed-Sync-Status (News/Bewertungen) — Tabellen existieren ab 20140000 / 20175000.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if to_regclass('public.restaurant_news_platform_sync') is not null then
      begin
        alter publication supabase_realtime add table public.restaurant_news_platform_sync;
      exception when duplicate_object then null;
      end;
    end if;
    if to_regclass('public.restaurant_reviews_platform_sync') is not null then
      begin
        alter publication supabase_realtime add table public.restaurant_reviews_platform_sync;
      exception when duplicate_object then null;
      end;
    end if;
  end if;
end $$;
