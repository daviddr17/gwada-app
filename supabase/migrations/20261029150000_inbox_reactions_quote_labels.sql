-- Inbox: reactions JSON + quote/reply fields; Gwada-native thread labels (+ optional WAHA id).

-- ---------------------------------------------------------------------------
-- contact_messages: live reactions + quote/reply
-- ---------------------------------------------------------------------------
alter table public.contact_messages
  add column if not exists reactions jsonb;

alter table public.contact_messages
  add column if not exists reply_to_external_source_id text;

alter table public.contact_messages
  add column if not exists reply_to_body text;

comment on column public.contact_messages.reactions is
  'Emoji-Reactions [{emoji, fromMe, senderId?}] — WAHA/Meta Live + History.';

comment on column public.contact_messages.reply_to_external_source_id is
  'Quoted message external_source_id (e.g. waha:…) for reply/quote.';

comment on column public.contact_messages.reply_to_body is
  'Snapshot of quoted message body for display across channels.';

-- ---------------------------------------------------------------------------
-- Inbox signals: optional payload + reaction source (no full thread reload)
-- ---------------------------------------------------------------------------
alter table public.restaurant_inbox_signals
  add column if not exists payload jsonb;

alter table public.restaurant_inbox_signals
  drop constraint if exists restaurant_inbox_signals_source_check;

alter table public.restaurant_inbox_signals
  add constraint restaurant_inbox_signals_source_check check (
    source in ('waha', 'waha_ack', 'waha_reaction', 'email')
  );

comment on column public.restaurant_inbox_signals.source is
  'waha = neue WAHA-Aktivität; waha_ack = Lese-/ACK-Update; waha_reaction = Reaction-Patch; email = IMAP-Hinweis.';

comment on column public.restaurant_inbox_signals.payload is
  'Optional: structured hint (e.g. reaction {wahaMessageId, emoji, fromMe, senderId}).';

-- ---------------------------------------------------------------------------
-- Gwada inbox labels (channel-agnostic triage) + optional WAHA Business Label id
-- ---------------------------------------------------------------------------
create table if not exists public.inbox_labels (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  background_color text not null default '#64748b',
  sort_order integer not null default 0,
  waha_label_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint inbox_labels_name_len check (char_length(name) <= 64),
  constraint inbox_labels_color_hex check (background_color ~ '^#[0-9A-Fa-f]{6}$')
);

create unique index if not exists inbox_labels_restaurant_name_uniq
  on public.inbox_labels (restaurant_id, lower(name));

create unique index if not exists inbox_labels_restaurant_waha_id_uniq
  on public.inbox_labels (restaurant_id, waha_label_id)
  where waha_label_id is not null;

create index if not exists inbox_labels_restaurant_sort_idx
  on public.inbox_labels (restaurant_id, sort_order, name);

drop trigger if exists inbox_labels_set_updated_at on public.inbox_labels;
create trigger inbox_labels_set_updated_at
  before update on public.inbox_labels
  for each row execute function public.set_updated_at();

alter table public.inbox_labels enable row level security;

drop policy if exists "inbox_labels_staff_all" on public.inbox_labels;
create policy "inbox_labels_staff_all"
  on public.inbox_labels for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));

create table if not exists public.inbox_label_assignments (
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  thread_key text not null,
  label_id uuid not null references public.inbox_labels (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (restaurant_id, thread_key, label_id),
  constraint inbox_label_assignments_thread_key_len check (char_length(thread_key) <= 320)
);

create index if not exists inbox_label_assignments_label_id_idx
  on public.inbox_label_assignments (label_id);

create index if not exists inbox_label_assignments_thread_idx
  on public.inbox_label_assignments (restaurant_id, thread_key);

alter table public.inbox_label_assignments enable row level security;

drop policy if exists "inbox_label_assignments_staff_all" on public.inbox_label_assignments;
create policy "inbox_label_assignments_staff_all"
  on public.inbox_label_assignments for all
  using (public.auth_is_restaurant_staff(restaurant_id))
  with check (public.auth_is_restaurant_staff(restaurant_id));
