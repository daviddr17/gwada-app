-- Gwada-Bewertungen: Inhaber-Antwort (Auto- + manuelle Antwort)

alter table public.gwada_reviews
  add column if not exists owner_reply text,
  add column if not exists owner_reply_at timestamptz;

comment on column public.gwada_reviews.owner_reply is
  'Öffentliche Antwort des Restaurants (manuell oder Auto-Antwort).';
comment on column public.gwada_reviews.owner_reply_at is
  'Zeitpunkt der Antwort-Veröffentlichung.';

drop policy if exists "gwada_reviews_staff_update" on public.gwada_reviews;
create policy "gwada_reviews_staff_update"
  on public.gwada_reviews for update
  to authenticated
  using (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'))
  with check (public.auth_has_restaurant_permission(restaurant_id, 'reviews.manage'));
