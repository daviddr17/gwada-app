-- Unverknüpfte Inbox-Threads (waha:/email:/meta:) in contact_messages spiegeln.

alter table public.contact_messages
  alter column contact_id drop not null;

alter table public.contact_messages
  add column if not exists conversation_key text,
  add column if not exists conversation_label text;

alter table public.contact_messages
  drop constraint if exists contact_messages_thread_ref_check;

alter table public.contact_messages
  add constraint contact_messages_thread_ref_check check (
    (contact_id is not null and conversation_key is null)
    or (contact_id is null and conversation_key is not null)
  );

create index if not exists contact_messages_conversation_key_idx
  on public.contact_messages (restaurant_id, conversation_key, created_at desc)
  where conversation_key is not null;

comment on column public.contact_messages.conversation_key is
  'Pseudo-Thread-ID (waha:, email:, meta:) wenn contact_id null.';

comment on column public.contact_messages.conversation_label is
  'Anzeigename für unverknüpfte Threads ohne contacts-Zeile.';

create or replace function public.trg_contact_messages_touch_contact()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.contact_id is null then
    return new;
  end if;

  update public.contacts c
  set
    last_interaction_at = greatest(
      coalesce(c.last_interaction_at, '-infinity'::timestamptz),
      new.created_at
    ),
    updated_at = timezone('utc', now())
  where c.id = new.contact_id;
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
  sender_email text;
  sender_phone text;
  body_trim text;
  preview text;
  media_line text;
  from_label text;
  payload_contact_id text;
begin
  if new.direction <> 'inbound' then
    return new;
  end if;

  payload_contact_id := coalesce(new.contact_id::text, new.conversation_key);

  if new.contact_id is not null then
    select coalesce(
      nullif(trim(concat_ws(' ', c.first_name, c.last_name)), ''),
      'Kontakt'
    )
    into contact_name
    from public.contacts c
    where c.id = new.contact_id;

    select ce.email
    into sender_email
    from public.contact_emails ce
    where ce.contact_id = new.contact_id
      and ce.restaurant_id = new.restaurant_id
    order by ce.is_primary desc, ce.sort_order asc
    limit 1;

    select cp.phone_display
    into sender_phone
    from public.contact_phones cp
    where cp.contact_id = new.contact_id
      and cp.restaurant_id = new.restaurant_id
    order by cp.is_primary desc, cp.sort_order asc
    limit 1;
  else
    contact_name := coalesce(nullif(trim(new.conversation_label), ''), 'Gast');

    if new.conversation_key like 'email:%' then
      sender_email := substring(new.conversation_key from 7);
    elsif new.conversation_key like 'waha:%' then
      sender_phone := substring(new.conversation_key from 6);
    end if;
  end if;

  body_trim := lower(trim(coalesce(new.body, '')));

  from_label := coalesce(
    nullif(trim(contact_name), 'Kontakt'),
    nullif(trim(sender_phone), ''),
    nullif(trim(sender_email), ''),
    'Gast'
  );

  if body_trim in ('whatsapp-anhang', 'anhang', 'datei') then
    media_line := '📎 Datei';
  elsif body_trim = 'bild' then
    media_line := '📷 Bild';
  elsif body_trim = 'video' then
    media_line := '🎬 Video';
  elsif body_trim = 'sprachnachricht' then
    media_line := '🎤 Sprachnachricht';
  else
    media_line := null;
  end if;

  if media_line is not null then
    preview := left(media_line || ' von ' || from_label, 120);
  else
    preview := left(trim(coalesce(new.body, '')), 120);
  end if;

  insert into public.notification_events (restaurant_id, module, reference_id, payload)
  select
    new.restaurant_id,
    'messages',
    new.id::text,
    jsonb_strip_nulls(jsonb_build_object(
      'contactId', payload_contact_id,
      'contactName', contact_name,
      'senderEmail', nullif(trim(coalesce(sender_email, '')), ''),
      'senderPhone', nullif(trim(coalesce(sender_phone, '')), ''),
      'preview', preview,
      'platform', new.platform,
      'messageCreatedAt', new.created_at
    ))
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
