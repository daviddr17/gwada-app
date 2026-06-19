-- WhatsApp-LID intern an contact_messaging_ids; Push/Inbox ohne @lid in Anzeigenamen.

alter table public.contact_messaging_ids
  drop constraint if exists contact_messaging_ids_platform_check;

alter table public.contact_messaging_ids
  add constraint contact_messaging_ids_platform_check check (
    platform in ('facebook', 'instagram', 'whatsapp')
  );

comment on column public.contact_messaging_ids.external_sender_id is
  'Meta PSID/IGSID oder WhatsApp @lid-JID — nur systemintern, nicht für UI.';

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
  waha_key text;
  waha_digits text;
begin
  if new.direction <> 'inbound' or coalesce(new.suppress_notifications, false) then
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

    if contact_name ~ '@(lid|c\.us|s\.whatsapp\.net)' then
      contact_name := 'Gast';
    end if;

    if new.conversation_key like 'email:%' then
      sender_email := substring(new.conversation_key from 7);
    elsif new.conversation_key like 'waha:%' then
      waha_key := substring(new.conversation_key from 6);
      if waha_key like '%@lid%' then
        sender_phone := null;
      elsif waha_key ~ '^[0-9]+@c\.us$' then
        waha_digits := regexp_replace(waha_key, '@c\.us$', '');
        sender_phone := '+' || waha_digits;
      else
        sender_phone := null;
      end if;
    end if;
  end if;

  body_trim := lower(trim(coalesce(new.body, '')));

  from_label := coalesce(
    nullif(trim(contact_name), 'Kontakt'),
    nullif(trim(contact_name), 'Gast'),
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
