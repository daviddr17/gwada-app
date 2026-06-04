-- Dashboard / Mitarbeiter: Realtime für Arbeitszeiten und Stammdaten.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.restaurant_staff_work_entries;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.restaurant_staff;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;

alter table public.restaurant_staff_work_entries replica identity full;
alter table public.restaurant_staff replica identity full;
