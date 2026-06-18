-- Changelog: Superadmin-Freigabe vor Sichtbarkeit für Endkunden.

alter table public.platform_changelog_entries
  add column approved_at timestamptz,
  add column approved_by uuid references auth.users (id) on delete set null;

-- Bestehende Einträge gelten als bereits freigegeben.
update public.platform_changelog_entries
set approved_at = created_at
where approved_at is null;

create index platform_changelog_entries_pending_idx
  on public.platform_changelog_entries (created_at desc)
  where approved_at is null;

drop policy if exists platform_changelog_entries_select_scoped
  on public.platform_changelog_entries;

create policy platform_changelog_entries_select_scoped
  on public.platform_changelog_entries
  for select
  to authenticated
  using (
    public.auth_is_superadmin()
    or (
      audience = 'customers'
      and approved_at is not null
    )
  );

-- Changelog-Push erst bei Freigabe (Funktion in 20260617180000).
drop trigger if exists platform_changelog_entries_notification_event
  on public.platform_changelog_entries;

create trigger platform_changelog_entries_notification_on_approve
  after update of approved_at on public.platform_changelog_entries
  for each row
  when (old.approved_at is null and new.approved_at is not null)
  execute function public.trg_emit_notification_event_changelog();

create trigger platform_changelog_entries_notification_on_insert_approved
  after insert on public.platform_changelog_entries
  for each row
  when (new.approved_at is not null)
  execute function public.trg_emit_notification_event_changelog();
