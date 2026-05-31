-- Eindeutige Zuordnung zu Git-Commit (Auto-Sync, keine Duplikate).

alter table public.platform_changelog_entries
  add column source_git_sha text;

create unique index platform_changelog_entries_source_git_sha_uidx
  on public.platform_changelog_entries (source_git_sha)
  where source_git_sha is not null;
