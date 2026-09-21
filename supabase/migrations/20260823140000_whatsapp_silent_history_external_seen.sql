-- WhatsApp-Historien-Import (Connect/silent) ließ external_seen oft false,
-- weil WAHA-ack auf Altnachrichten fehlt → Sidebar „Nachrichten (88)“ aus
-- Summen von Message-Unread. Historische silent-Spiegel als Kanal-gelesen markieren.
-- Frische Cron-Catch-ups (< 3h) bleiben unberührt.

update public.contact_messages
set external_seen = true
where platform = 'whatsapp'
  and direction = 'inbound'
  and suppress_notifications is true
  and coalesce(external_seen, false) = false
  and external_source_id like 'waha:%'
  and created_at < (timezone('utc', now()) - interval '3 hours');
