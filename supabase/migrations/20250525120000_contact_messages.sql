-- Kontakt-Nachrichten (Plattformen, Reservierungsbezug, Chat-Verlauf).

create table public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  contact_id uuid not null references public.contacts (id) on delete cascade,
  platform text not null,
  direction text not null,
  body text not null,
  reservation_id uuid references public.reservations (id) on delete set null,
  sent_by uuid references auth.users (id) on delete set null,
  delivery_status text not null default 'delivered',
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_messages_platform_check check (
    platform in ('gwada', 'whatsapp', 'email', 'facebook', 'instagram')
  ),
  constraint contact_messages_direction_check check (
    direction in ('inbound', 'outbound')
  ),
  constraint contact_messages_body_len check (char_length(body) <= 8000)
);

create index contact_messages_restaurant_created_idx
  on public.contact_messages (restaurant_id, created_at desc);

create index contact_messages_contact_created_idx
  on public.contact_messages (contact_id, created_at desc);

create index contact_messages_contact_platform_idx
  on public.contact_messages (contact_id, platform, created_at desc);

create index contact_messages_reservation_idx
  on public.contact_messages (reservation_id)
  where reservation_id is not null;

alter table public.contact_messages enable row level security;

create policy "contact_messages_staff_all"
  on public.contact_messages for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create or replace function public.trg_contact_messages_touch_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts c
  set
    last_interaction_at = greatest(
      coalesce(c.last_interaction_at, '-infinity'::timestamptz),
      new.created_at
    ),
    updated_at = timezone('utc', now())
  where c.id = new.contact_id;
  return new;
end;
$$;

create trigger contact_messages_touch_contact_after_ins
  after insert on public.contact_messages
  for each row execute function public.trg_contact_messages_touch_contact();
