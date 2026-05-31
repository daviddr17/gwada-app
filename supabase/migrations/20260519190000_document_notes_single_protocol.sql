-- Eine Notiz-Art: protokollartige Einträge; Bearbeiten nur mit documents.notes.edit.

drop trigger if exists restaurant_documents_internal_note_guard on public.restaurant_documents;
drop function if exists public.restaurant_documents_guard_internal_note();

alter table public.restaurant_documents
  drop column if exists internal_note;

create policy restaurant_document_note_entries_staff_update
  on public.restaurant_document_note_entries for update
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'documents.notes.edit')
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and public.auth_has_restaurant_permission(restaurant_id, 'documents.notes.edit')
  );
