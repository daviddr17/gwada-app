-- Nickname/Slug-Eindeutigkeit prüfen (RLS sieht fremde Restaurants oft nicht).

create or replace function public.restaurant_slug_available(
  p_slug text,
  p_exclude_restaurant_id uuid default null
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.restaurants r
    where r.slug = p_slug
      and (p_exclude_restaurant_id is null or r.id <> p_exclude_restaurant_id)
  );
$$;

revoke all on function public.restaurant_slug_available(text, uuid) from public;
grant execute on function public.restaurant_slug_available(text, uuid) to authenticated;
