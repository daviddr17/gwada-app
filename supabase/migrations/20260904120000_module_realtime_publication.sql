-- Schema only: Realtime-Publication für Module, die der Client schon subscribed,
-- aber nie Events bekommen hat (Kanal SUBSCRIBED, Tabelle nicht in Publication).
-- Keine Datenänderungen, keine Seeds, kein UPDATE bestehender Zeilen.

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.menu_items;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.menu_categories;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.menu_main_categories;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.contacts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_staff_scheduled_shifts;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_staff_todos;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.dining_tables;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.dining_areas;
    exception when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_integrations;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.menu_items replica identity full;
alter table public.menu_categories replica identity full;
alter table public.menu_main_categories replica identity full;
alter table public.contacts replica identity full;
alter table public.restaurant_staff_scheduled_shifts replica identity full;
alter table public.restaurant_staff_todos replica identity full;
alter table public.dining_tables replica identity full;
alter table public.dining_areas replica identity full;
alter table public.restaurant_integrations replica identity full;
