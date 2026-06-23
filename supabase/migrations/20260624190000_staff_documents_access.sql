-- Mitarbeiter-Dokumente: Lesen für HR (staff.read) und eigenes Profil (Vertrags-PDFs)

create policy "restaurant_documents_select_own_staff"
  on public.restaurant_documents for select
  to authenticated
  using (
    staff_id is not null
    and exists (
      select 1
      from public.restaurant_staff rs
      where rs.id = restaurant_documents.staff_id
        and rs.restaurant_id = restaurant_documents.restaurant_id
        and rs.profile_id = (select auth.uid())
    )
  );

create policy "restaurant_documents_select_staff_module"
  on public.restaurant_documents for select
  to authenticated
  using (
    staff_id is not null
    and public.auth_has_restaurant_permission(restaurant_id, 'staff.read')
  );

comment on policy "restaurant_documents_select_own_staff" on public.restaurant_documents is
  'Mitarbeiter sehen eigene Dokumente (z. B. Vertrags-PDFs) im Profil.';
comment on policy "restaurant_documents_select_staff_module" on public.restaurant_documents is
  'HR mit staff.read sieht Dokumente mit Mitarbeiter-Zuordnung.';
