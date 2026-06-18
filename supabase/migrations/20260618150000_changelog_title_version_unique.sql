-- Changelog: keine Duplikate pro Titel+Version (unabhängig von source_git_sha / Draft vs. Commit).

-- Legacy: Version aus published_at ableiten, falls leer.
update public.platform_changelog_entries
set version = to_char(published_at at time zone 'UTC', 'YYYY.MM.DD')
where version is null or trim(version) = '';

-- Bestehende Duplikate entfernen: freigegeben bevorzugen, sonst ältester Eintrag.
with ranked as (
  select
    id,
    row_number() over (
      partition by title, version
      order by (approved_at is not null) desc, created_at asc
    ) as rn
  from public.platform_changelog_entries
)
delete from public.platform_changelog_entries e
using ranked r
where e.id = r.id
  and r.rn > 1;

create unique index if not exists platform_changelog_entries_title_version_uniq
  on public.platform_changelog_entries (title, version);
