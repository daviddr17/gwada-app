-- Team-Gelesen: max(last_read_at) pro Konversation für Soft-Unread (Kollege hat gelesen).

create or replace function public.communal_conversation_reads(p_restaurant_id uuid)
returns table (
  conversation_key text,
  platform text,
  communal_last_read_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select
    c.conversation_key,
    c.platform,
    max(c.last_read_at) as communal_last_read_at
  from public.contact_conversation_reads c
  where c.restaurant_id = p_restaurant_id
    and c.last_read_at is not null
    and public.auth_is_restaurant_staff(p_restaurant_id)
  group by c.conversation_key, c.platform;
$$;

revoke all on function public.communal_conversation_reads(uuid) from public;
grant execute on function public.communal_conversation_reads(uuid) to authenticated;

comment on column public.contact_messages.external_seen is
  'email-imap: IMAP \\Seen; waha: gelesen am Kanal; null = nicht relevant (reine Gwada-Nachricht).';

-- Bestehende WAHA-Spiegel ohne Stand: als am Kanal gelesen (Soft-Unread statt alles „neu“).
update public.contact_messages
set external_seen = true
where external_source_id like 'waha:%'
  and direction = 'inbound'
  and external_seen is null;
