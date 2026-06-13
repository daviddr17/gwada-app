-- Push-Payloads: Quell-Zeitstempel für Superadmin-Log und Debugging (Gwada-Bewertungen, Nachrichten).

create or replace function public.trg_emit_notification_event_gwada_review()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'reviews',
    new.id::text,
    jsonb_build_object(
      'rating', new.rating,
      'authorName', coalesce(nullif(trim(new.guest_display_name), ''), 'Gast'),
      'commentPreview', left(trim(coalesce(new.comment, '')), 120),
      'platform', 'gwada',
      'reviewCreatedAt', new.created_at
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'reviews'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;

create or replace function public.trg_emit_notification_event_messages()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  contact_name text;
  preview text;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  select coalesce(
    nullif(trim(concat_ws(' ', c.given_name, c.family_name)), ''),
    'Kontakt'
  )
  into contact_name
  from public.contacts c
  where c.id = new.contact_id;

  preview := left(trim(coalesce(new.body, '')), 120);

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'messages',
    new.id::text,
    jsonb_build_object(
      'contactId', new.contact_id,
      'contactName', contact_name,
      'preview', preview,
      'platform', new.platform,
      'messageCreatedAt', new.created_at
    )
  where not exists (
    select 1
    from public.notification_events e
    where e.module = 'messages'
      and e.reference_id = new.id::text
      and coalesce(e.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = coalesce(new.restaurant_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

  return new;
end;
$$;
