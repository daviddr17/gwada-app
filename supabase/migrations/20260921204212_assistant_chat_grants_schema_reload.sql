-- Assistent-Tabellen: Rechte für PostgREST + Schema-Cache neu laden.
-- Ohne GRANT auf authenticated erscheint oft PGRST205
-- „Could not find the table … in the schema cache“ schon beim Öffnen der Historie.

grant select, insert, update, delete
  on table public.assistant_chat_threads
  to authenticated, service_role;

grant select, insert, update, delete
  on table public.assistant_chat_messages
  to authenticated, service_role;

notify pgrst, 'reload schema';
