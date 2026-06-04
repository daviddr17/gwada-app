-- Dashboard: Supabase Realtime für neue Reservierungen und Nachrichten (INSERT).
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.reservations;
    exception
      when duplicate_object then null;
    end;
    begin
      alter publication supabase_realtime add table public.contact_messages;
    exception
      when duplicate_object then null;
    end;
  end if;
end $$;
