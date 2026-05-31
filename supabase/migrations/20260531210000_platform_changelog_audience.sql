-- Changelog: Kunden vs. Superadmin-only (RLS filtert Endkunden aus).

alter table public.platform_changelog_entries
  add column audience text not null default 'customers'
  check (audience in ('customers', 'superadmin'));

create index platform_changelog_entries_audience_published_at_idx
  on public.platform_changelog_entries (audience, published_at desc);

drop policy if exists platform_changelog_entries_select_authenticated
  on public.platform_changelog_entries;

create policy platform_changelog_entries_select_scoped
  on public.platform_changelog_entries
  for select
  to authenticated
  using (
    audience = 'customers'
    or public.auth_is_superadmin()
  );
