-- Plattform-Changelog für eingeloggte Nutzer (Superadmin pflegt Einträge).

create table public.platform_changelog_entries (
  id uuid primary key default gen_random_uuid(),
  published_at timestamptz not null default timezone('utc', now()),
  title text not null check (char_length(trim(title)) > 0),
  body text not null default '',
  version text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index platform_changelog_entries_published_at_idx
  on public.platform_changelog_entries (published_at desc);

create trigger platform_changelog_entries_set_updated_at
  before update on public.platform_changelog_entries
  for each row execute function public.set_updated_at();

alter table public.platform_changelog_entries enable row level security;

create policy platform_changelog_entries_select_authenticated
  on public.platform_changelog_entries
  for select
  to authenticated
  using (true);

create policy platform_changelog_entries_insert_superadmin
  on public.platform_changelog_entries
  for insert
  to authenticated
  with check (public.auth_is_superadmin());

create policy platform_changelog_entries_update_superadmin
  on public.platform_changelog_entries
  for update
  to authenticated
  using (public.auth_is_superadmin())
  with check (public.auth_is_superadmin());

create policy platform_changelog_entries_delete_superadmin
  on public.platform_changelog_entries
  for delete
  to authenticated
  using (public.auth_is_superadmin());
