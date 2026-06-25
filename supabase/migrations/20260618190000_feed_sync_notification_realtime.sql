-- Realtime für Glocke (notification_events).
-- Feed-Sync-Tabellen: siehe 20260621150100_feed_sync_platform_realtime.sql

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.notification_events;
    exception when duplicate_object then null;
    end;
  end if;
end $$;
