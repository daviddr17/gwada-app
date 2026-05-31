-- Gelesen/Ungelesen pro Nutzer, Restaurant und Konversation (Gwada + WAHA-Pseudo).

create table public.contact_conversation_reads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  conversation_key text not null,
  platform text not null,
  last_read_at timestamptz,
  marked_unread_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contact_conversation_reads_platform_check check (
    platform in ('gwada', 'whatsapp', 'email', 'facebook', 'instagram')
  ),
  constraint contact_conversation_reads_unique unique (
    restaurant_id,
    user_id,
    conversation_key,
    platform
  )
);

create index contact_conversation_reads_user_restaurant_idx
  on public.contact_conversation_reads (restaurant_id, user_id);

alter table public.contact_conversation_reads enable row level security;

create policy "contact_conversation_reads_own_staff"
  on public.contact_conversation_reads for all
  using (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

create or replace function public.trg_contact_conversation_reads_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger contact_conversation_reads_updated_at
  before update on public.contact_conversation_reads
  for each row execute function public.trg_contact_conversation_reads_set_updated_at();
