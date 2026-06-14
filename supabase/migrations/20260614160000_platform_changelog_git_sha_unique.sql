-- Supabase upsert/onConflict(source_git_sha) needs a non-partial unique index.
-- Partial indexes (WHERE source_git_sha IS NOT NULL) do not match ON CONFLICT inference.

drop index if exists public.platform_changelog_entries_source_git_sha_uidx;
drop index if exists public.platform_changelog_entries_source_git_sha_uniq;

create unique index platform_changelog_entries_source_git_sha_uniq
  on public.platform_changelog_entries (source_git_sha);
