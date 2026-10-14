# WAHA-Webhooks (Kontakt-Inbox)

## Einrichtung (automatisch)

Beim WhatsApp-Verbinden (`syncWhatsappFromWaha`) wird pro Restaurant-Session konfiguriert:

- **URL:** `https://<SITE>/api/integrations/waha/webhook` (`NEXT_PUBLIC_SITE_URL` / `getPublicSiteUrl()`)
- **Events:** `message` (eingehend), `message.any` (alle Erstellungen inkl. Handy-Outbound `fromMe`), `message.ack` (gelesen / Zustellstatus)
- **Metadata:** `gwada.restaurant_id` = Restaurant-UUID
- **Update:** `wahaUpdateSessionWebhooks` bei Connect und Session-Restart
- **Session-Config:** `webjs.tagsEventsOn: true` (falls WEBJS-Engine), NOWEB-Store wie bisher

Optional in `.env` / Production:

- `WAHA_WEBHOOK_HMAC_KEY` — HMAC-SHA512, Header `X-Webhook-Hmac` (ohne Key: Verifikation aus)

## Ablauf bei Nachricht (`message` / `message.any`)

1. WAHA POST → `/api/integrations/waha/webhook`
2. **`fromMe` (Handy / Gwada-Send):** `linkOutboundWhatsappFromWahaWebhook` — Pending verknüpfen oder Outbound-Spiegel anlegen (idempotent über `external_source_id`)
3. **Eingehend, verknüpfter Kontakt:** Spiegel in `contact_messages` (`platform: whatsapp`) → Supabase Realtime; Caption/Text aus WAHA/`_data` (Bild+Beschreibung, Katalog, …)
4. **Nicht verknüpft (nur WAHA-Chat):** Eintrag in `restaurant_inbox_signals` (`source: waha`) → Realtime
5. Client (Dashboard + Kontakte): debounced leiser Inbox-Refresh — **kein** 5-Min-Polling nötig solange Realtime läuft
6. **Push:** `notification_events` → Sofort-Zustellung per `after()` im Webhook/Ingest (`runNotificationDeliverForEvent`); Cron alle 2 Min als Fallback
7. Fallback: 5-Min-Polling nur wenn Realtime nicht verbindet

Nach Deploy: Webhooks auf bestehenden Sessions refreshen (`pnpm refresh:waha:live` / Superadmin Session-Webhook-Update), sonst bleibt `message.any` aus.

## Ablauf bei ACK / Gelesen (`message.ack`)

1. WAHA POST mit `payload.ack` (3 = gelesen, 4 = abgespielt bei Sprachnachrichten)
2. **Spiegel-Nachricht in DB:** `delivery_status` auf `contact_messages` mit `external_source_id: waha:…` aktualisieren
3. **Signal:** `restaurant_inbox_signals` (`source: waha_ack`) → Realtime, **ohne** „Neue Nachricht“-Toast
4. Client: leiser Inbox-Refresh → WAHA-Overview für `external_unread_count` (Glocke + Kontakte)

Damit entfällt der Voll-Sync aller WAHA-Threads beim Glocke-Öffnen; Pull bleibt nur als Overview-Refresh nach Signal.

## Fallbacks

- Cron `GET /api/cron/contact-inbox-sync` (WAHA-Thread-Sync pro verknüpftem Kontakt)
- Manueller Refresh in der Nachrichten-Übersicht
- 5-Min-Hintergrund-Sync (`useUnifiedInboxBackgroundSync`)
