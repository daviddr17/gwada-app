-- PostgREST-Schema-Cache nach contact_message_attachments aktualisieren (self-hosted).
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'contact_message_attachments'
  ) then
    notify pgrst, 'reload schema';
  end if;
end $$;
