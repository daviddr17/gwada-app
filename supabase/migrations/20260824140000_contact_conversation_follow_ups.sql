-- Später: team-sichtbare Follow-ups pro Inbox-Konversation (Grund, Reminder, Mitarbeiter-Todo).

create table public.contact_conversation_follow_ups (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  conversation_key text not null,
  reason text,
  remind_at timestamptz,
  reminded_at timestamptz,
  assigned_staff_id uuid references public.restaurant_staff (id) on delete set null,
  staff_todo_id uuid references public.restaurant_staff_todos (id) on delete set null,
  contact_display_name text,
  created_by uuid references auth.users (id) on delete set null,
  cleared_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contact_conversation_follow_ups_reason_len check (
    reason is null or char_length(reason) <= 500
  )
);

create unique index contact_conversation_follow_ups_active_uniq
  on public.contact_conversation_follow_ups (restaurant_id, conversation_key)
  where cleared_at is null;

create index contact_conversation_follow_ups_restaurant_active_idx
  on public.contact_conversation_follow_ups (restaurant_id)
  where cleared_at is null;

create index contact_conversation_follow_ups_remind_due_idx
  on public.contact_conversation_follow_ups (restaurant_id, remind_at)
  where cleared_at is null and remind_at is not null;

alter table public.contact_conversation_follow_ups enable row level security;

create policy "contact_conversation_follow_ups_staff"
  on public.contact_conversation_follow_ups for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create or replace function public.trg_contact_conversation_follow_ups_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create trigger contact_conversation_follow_ups_updated_at
  before update on public.contact_conversation_follow_ups
  for each row execute function public.trg_contact_conversation_follow_ups_set_updated_at();
