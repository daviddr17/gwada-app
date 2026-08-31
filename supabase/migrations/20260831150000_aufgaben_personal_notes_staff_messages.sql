-- Persönliche Notizen/Erinnerungen + Team-Nachrichten (Modul Aufgaben).

-- ---------------------------------------------------------------------------
-- Persönliche Notizen (nur eigener User)
-- ---------------------------------------------------------------------------

create table public.restaurant_personal_notes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text,
  remind_at timestamptz,
  reminded_at timestamptz,
  completed_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_personal_notes_title_len check (
    char_length(title) between 1 and 200
  ),
  constraint restaurant_personal_notes_body_len check (
    body is null or char_length(body) <= 8000
  )
);

create index restaurant_personal_notes_owner_active_idx
  on public.restaurant_personal_notes (restaurant_id, profile_id, created_at desc)
  where archived_at is null;

create index restaurant_personal_notes_remind_due_idx
  on public.restaurant_personal_notes (restaurant_id, profile_id, remind_at)
  where archived_at is null
    and completed_at is null
    and remind_at is not null
    and reminded_at is null;

create trigger restaurant_personal_notes_set_updated_at
  before update on public.restaurant_personal_notes
  for each row execute function public.set_updated_at();

alter table public.restaurant_personal_notes enable row level security;

create policy restaurant_personal_notes_own_all
  on public.restaurant_personal_notes for all
  to authenticated
  using (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  )
  with check (
    profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
  );

comment on table public.restaurant_personal_notes is
  'Private Notizen/Erinnerungen pro Profil × Restaurant — nur Eigentümer sichtbar.';

-- ---------------------------------------------------------------------------
-- Team-Nachrichten (1:1, Teilnehmer = profiles)
-- ---------------------------------------------------------------------------

create table public.restaurant_staff_conversations (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  -- Sortierte Profile-Paar-Keys für 1:1-Dedup (a < b).
  participant_a uuid not null references public.profiles (id) on delete cascade,
  participant_b uuid not null references public.profiles (id) on delete cascade,
  last_message_at timestamptz,
  last_message_preview text,
  last_sender_profile_id uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint restaurant_staff_conversations_pair_order check (participant_a < participant_b),
  constraint restaurant_staff_conversations_pair_unique unique (
    restaurant_id,
    participant_a,
    participant_b
  ),
  constraint restaurant_staff_conversations_preview_len check (
    last_message_preview is null or char_length(last_message_preview) <= 280
  )
);

create index restaurant_staff_conversations_restaurant_recent_idx
  on public.restaurant_staff_conversations (restaurant_id, last_message_at desc nulls last);

create trigger restaurant_staff_conversations_set_updated_at
  before update on public.restaurant_staff_conversations
  for each row execute function public.set_updated_at();

create table public.restaurant_staff_conversation_reads (
  conversation_id uuid not null
    references public.restaurant_staff_conversations (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (conversation_id, profile_id)
);

create table public.restaurant_staff_messages (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  conversation_id uuid not null
    references public.restaurant_staff_conversations (id) on delete cascade,
  sender_profile_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint restaurant_staff_messages_body_len check (
    char_length(body) between 1 and 8000
  )
);

create index restaurant_staff_messages_conversation_created_idx
  on public.restaurant_staff_messages (conversation_id, created_at desc);

create index restaurant_staff_messages_restaurant_created_idx
  on public.restaurant_staff_messages (restaurant_id, created_at desc);

alter table public.restaurant_staff_conversations enable row level security;
alter table public.restaurant_staff_conversation_reads enable row level security;
alter table public.restaurant_staff_messages enable row level security;

create policy restaurant_staff_conversations_participant_select
  on public.restaurant_staff_conversations for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      participant_a = (select auth.uid())
      or participant_b = (select auth.uid())
    )
  );

create policy restaurant_staff_conversations_participant_insert
  on public.restaurant_staff_conversations for insert
  to authenticated
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      participant_a = (select auth.uid())
      or participant_b = (select auth.uid())
    )
  );

create policy restaurant_staff_conversations_participant_update
  on public.restaurant_staff_conversations for update
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      participant_a = (select auth.uid())
      or participant_b = (select auth.uid())
    )
  )
  with check (
    public.auth_is_restaurant_staff(restaurant_id)
    and (
      participant_a = (select auth.uid())
      or participant_b = (select auth.uid())
    )
  );

create policy restaurant_staff_conversation_reads_own
  on public.restaurant_staff_conversation_reads for all
  to authenticated
  using (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.restaurant_staff_conversations c
      where c.id = conversation_id
        and public.auth_is_restaurant_staff(c.restaurant_id)
        and (
          c.participant_a = (select auth.uid())
          or c.participant_b = (select auth.uid())
        )
    )
  )
  with check (
    profile_id = (select auth.uid())
    and exists (
      select 1
      from public.restaurant_staff_conversations c
      where c.id = conversation_id
        and public.auth_is_restaurant_staff(c.restaurant_id)
        and (
          c.participant_a = (select auth.uid())
          or c.participant_b = (select auth.uid())
        )
    )
  );

create policy restaurant_staff_messages_participant_select
  on public.restaurant_staff_messages for select
  to authenticated
  using (
    public.auth_is_restaurant_staff(restaurant_id)
    and exists (
      select 1
      from public.restaurant_staff_conversations c
      where c.id = conversation_id
        and (
          c.participant_a = (select auth.uid())
          or c.participant_b = (select auth.uid())
        )
    )
  );

create policy restaurant_staff_messages_participant_insert
  on public.restaurant_staff_messages for insert
  to authenticated
  with check (
    sender_profile_id = (select auth.uid())
    and public.auth_is_restaurant_staff(restaurant_id)
    and exists (
      select 1
      from public.restaurant_staff_conversations c
      where c.id = conversation_id
        and c.restaurant_id = restaurant_id
        and (
          c.participant_a = (select auth.uid())
          or c.participant_b = (select auth.uid())
        )
    )
  );

comment on table public.restaurant_staff_conversations is
  '1:1 Team-Chats zwischen zwei Profilen im Restaurant.';
comment on table public.restaurant_staff_messages is
  'Nachrichten in Team-Chats — nur Teilnehmer lesen/schreiben.';
