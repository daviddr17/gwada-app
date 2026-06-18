-- Changelog-Push erst bei Freigabe, nicht beim Sync-Insert (vermeidet Doppel-Pushes bei Pending-Einträgen).

drop trigger if exists platform_changelog_entries_notification_event
  on public.platform_changelog_entries;

create or replace function public.trg_emit_notification_event_changelog()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.audience is distinct from 'customers' then
    return new;
  end if;

  if new.approved_at is null then
    return new;
  end if;

  if tg_op = 'UPDATE' and old.approved_at is not null then
    return new;
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    null,
    'changelog',
    new.id::text,
    jsonb_build_object(
      'title', new.title,
      'version', new.version,
      'publishedAt', new.published_at
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'changelog'
      and e.reference_id = new.id::text
      and e.restaurant_id is null
  );

  return new;
end;
$$;

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
