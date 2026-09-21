-- Dashboard-Assistent: Chat-Histor + OpenAI-Plattform-Integration

insert into public.platform_integrations (key, enabled, config)
values ('openai', false, '{}'::jsonb)
on conflict (key) do nothing;

create table if not exists public.assistant_chat_threads (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null default 'Neuer Chat',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assistant_chat_threads_restaurant_user_updated_idx
  on public.assistant_chat_threads (restaurant_id, user_id, updated_at desc);

create table if not exists public.assistant_chat_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.assistant_chat_threads (id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system', 'tool')),
  content text not null default '',
  tool_name text,
  tool_call_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists assistant_chat_messages_thread_created_idx
  on public.assistant_chat_messages (thread_id, created_at asc);

alter table public.assistant_chat_threads enable row level security;
alter table public.assistant_chat_messages enable row level security;

drop policy if exists assistant_chat_threads_select on public.assistant_chat_threads;
create policy assistant_chat_threads_select
  on public.assistant_chat_threads
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

drop policy if exists assistant_chat_threads_insert on public.assistant_chat_threads;
create policy assistant_chat_threads_insert
  on public.assistant_chat_threads
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

drop policy if exists assistant_chat_threads_update on public.assistant_chat_threads;
create policy assistant_chat_threads_update
  on public.assistant_chat_threads
  for update
  to authenticated
  using (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

drop policy if exists assistant_chat_threads_delete on public.assistant_chat_threads;
create policy assistant_chat_threads_delete
  on public.assistant_chat_threads
  for delete
  to authenticated
  using (
    user_id = auth.uid()
    and public.auth_is_restaurant_staff(restaurant_id)
  );

drop policy if exists assistant_chat_messages_select on public.assistant_chat_messages;
create policy assistant_chat_messages_select
  on public.assistant_chat_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.assistant_chat_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
        and public.auth_is_restaurant_staff(t.restaurant_id)
    )
  );

drop policy if exists assistant_chat_messages_insert on public.assistant_chat_messages;
create policy assistant_chat_messages_insert
  on public.assistant_chat_messages
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.assistant_chat_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
        and public.auth_is_restaurant_staff(t.restaurant_id)
    )
  );

drop policy if exists assistant_chat_messages_delete on public.assistant_chat_messages;
create policy assistant_chat_messages_delete
  on public.assistant_chat_messages
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.assistant_chat_threads t
      where t.id = thread_id
        and t.user_id = auth.uid()
        and public.auth_is_restaurant_staff(t.restaurant_id)
    )
  );

comment on table public.assistant_chat_threads is
  'Dashboard-Assistent: Chat-Threads pro Restaurant und User.';
comment on table public.assistant_chat_messages is
  'Dashboard-Assistent: Nachrichten eines Threads.';
