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
  using (public.staff_can_restaurant_module(restaurant_id, 'reviews', 'update'))
  with check (public.staff_can_restaurant_module(restaurant_id, 'reviews', 'update'));
