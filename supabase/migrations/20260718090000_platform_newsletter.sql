-- Platform newsletter: subscribers, drafts/templates, blocks, outbox, storage.

alter table public.profiles
  add column if not exists newsletter_subscribed boolean not null default false;

comment on column public.profiles.newsletter_subscribed is
  'Opt-in für Platform-Newsletter (Profil → Benachrichtigungen).';

create table if not exists public.platform_newsletter_subscribers (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  email_normalized text not null,
  profile_id uuid references public.profiles (id) on delete set null,
  locale text not null default 'de',
  opted_in boolean not null default true,
  opted_in_at timestamptz,
  opted_out_at timestamptz,
  unsubscribe_token text not null default encode(gen_random_bytes(24), 'hex'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_newsletter_subscribers_email_normalized_key unique (email_normalized),
  constraint platform_newsletter_subscribers_unsubscribe_token_key unique (unsubscribe_token)
);

create index if not exists platform_newsletter_subscribers_opted_in_idx
  on public.platform_newsletter_subscribers (opted_in)
  where opted_in = true;

create index if not exists platform_newsletter_subscribers_profile_id_idx
  on public.platform_newsletter_subscribers (profile_id)
  where profile_id is not null;

create table if not exists public.platform_newsletters (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default '',
  preheader text,
  status text not null default 'draft'
    check (status in ('draft', 'scheduled', 'sending', 'sent', 'cancelled')),
  scheduled_at timestamptz,
  started_at timestamptz,
  sent_at timestamptz,
  is_template boolean not null default false,
  source_newsletter_id uuid references public.platform_newsletters (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_newsletters_status_idx
  on public.platform_newsletters (status, scheduled_at);

create index if not exists platform_newsletters_template_idx
  on public.platform_newsletters (is_template, updated_at desc);

create table if not exists public.platform_newsletter_blocks (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.platform_newsletters (id) on delete cascade,
  sort_order integer not null default 0,
  heading text not null default '',
  body text not null default '',
  image_path text,
  image_alt text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists platform_newsletter_blocks_newsletter_idx
  on public.platform_newsletter_blocks (newsletter_id, sort_order);

create table if not exists public.platform_newsletter_translations (
  newsletter_id uuid not null references public.platform_newsletters (id) on delete cascade,
  locale text not null,
  subject text not null,
  preheader text,
  blocks_json jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  primary key (newsletter_id, locale)
);

create table if not exists public.platform_newsletter_outbox (
  id uuid primary key default gen_random_uuid(),
  newsletter_id uuid not null references public.platform_newsletters (id) on delete cascade,
  subscriber_id uuid not null references public.platform_newsletter_subscribers (id) on delete cascade,
  email text not null,
  locale text not null default 'de',
  status text not null default 'pending'
    check (status in ('pending', 'sent', 'failed', 'skipped')),
  attempts integer not null default 0,
  last_error text,
  send_at timestamptz not null default now(),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (newsletter_id, subscriber_id)
);

create index if not exists platform_newsletter_outbox_due_idx
  on public.platform_newsletter_outbox (status, send_at)
  where status = 'pending';

alter table public.platform_newsletter_subscribers enable row level security;
alter table public.platform_newsletters enable row level security;
alter table public.platform_newsletter_blocks enable row level security;
alter table public.platform_newsletter_translations enable row level security;
alter table public.platform_newsletter_outbox enable row level security;

-- Superadmin-only for content tables (service role bypasses RLS for send/cron).
drop policy if exists platform_newsletters_superadmin_all on public.platform_newsletters;
create policy platform_newsletters_superadmin_all
  on public.platform_newsletters
  for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

drop policy if exists platform_newsletter_blocks_superadmin_all on public.platform_newsletter_blocks;
create policy platform_newsletter_blocks_superadmin_all
  on public.platform_newsletter_blocks
  for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

drop policy if exists platform_newsletter_translations_superadmin_all
  on public.platform_newsletter_translations;
create policy platform_newsletter_translations_superadmin_all
  on public.platform_newsletter_translations
  for all
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

drop policy if exists platform_newsletter_subscribers_superadmin_select
  on public.platform_newsletter_subscribers;
create policy platform_newsletter_subscribers_superadmin_select
  on public.platform_newsletter_subscribers
  for select
  to authenticated
  using (public.auth_is_superadmin());

drop policy if exists platform_newsletter_subscribers_own_select
  on public.platform_newsletter_subscribers;
create policy platform_newsletter_subscribers_own_select
  on public.platform_newsletter_subscribers
  for select
  to authenticated
  using (profile_id = auth.uid());

drop policy if exists platform_newsletter_outbox_superadmin_select
  on public.platform_newsletter_outbox;
create policy platform_newsletter_outbox_superadmin_select
  on public.platform_newsletter_outbox
  for select
  to authenticated
  using (public.auth_is_superadmin());

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'platform-newsletter',
  'platform-newsletter',
  true,
  5242880,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists platform_newsletter_objects_select_public on storage.objects;
create policy platform_newsletter_objects_select_public
  on storage.objects
  for select
  to public
  using (bucket_id = 'platform-newsletter');

drop policy if exists platform_newsletter_objects_insert_superadmin on storage.objects;
create policy platform_newsletter_objects_insert_superadmin
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'platform-newsletter'
    and public.auth_is_superadmin()
  );

drop policy if exists platform_newsletter_objects_update_superadmin on storage.objects;
create policy platform_newsletter_objects_update_superadmin
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'platform-newsletter'
    and public.auth_is_superadmin()
  )
  with check (
    bucket_id = 'platform-newsletter'
    and public.auth_is_superadmin()
  );

drop policy if exists platform_newsletter_objects_delete_superadmin on storage.objects;
create policy platform_newsletter_objects_delete_superadmin
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'platform-newsletter'
    and public.auth_is_superadmin()
  );
