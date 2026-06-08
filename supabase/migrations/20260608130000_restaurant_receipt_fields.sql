-- Receipt footer fields (POS thermal PDF, Loyaro parity).

alter table public.restaurants
  add column if not exists vat_number text,
  add column if not exists receipt_footer text,
  add column if not exists social_handle text;

alter table public.restaurants
  drop constraint if exists restaurants_vat_number_len_check;

alter table public.restaurants
  add constraint restaurants_vat_number_len_check
  check (vat_number is null or char_length(vat_number) between 1 and 32);

alter table public.restaurants
  drop constraint if exists restaurants_receipt_footer_len_check;

alter table public.restaurants
  add constraint restaurants_receipt_footer_len_check
  check (receipt_footer is null or char_length(receipt_footer) between 1 and 500);

alter table public.restaurants
  drop constraint if exists restaurants_social_handle_len_check;

alter table public.restaurants
  add constraint restaurants_social_handle_len_check
  check (social_handle is null or char_length(social_handle) between 1 and 120);

comment on column public.restaurants.vat_number is
  'USt-IdNr. auf POS-Quittungen (z. B. DE123456789).';
comment on column public.restaurants.receipt_footer is
  'Freitext unter der Quittung (z. B. Dankesnachricht).';
comment on column public.restaurants.social_handle is
  'Social-Handle auf Quittungen (z. B. @restaurant).';

-- UTC bounds for "paid today" lists (restaurant local calendar day).
create or replace function public.pos_restaurant_today_bounds(p_restaurant_id uuid)
returns table (start_at timestamptz, end_at timestamptz)
language sql
stable
security definer
set search_path = public
as $$
  with r as (
    select coalesce(nullif(trim(timezone), ''), 'Europe/Berlin') as tz
    from public.restaurants
    where id = p_restaurant_id
  )
  select
    (date_trunc('day', now() at time zone r.tz) at time zone r.tz) as start_at,
    ((date_trunc('day', now() at time zone r.tz) + interval '1 day') at time zone r.tz) as end_at
  from r;
$$;
