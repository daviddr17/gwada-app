# WAHA-Webhooks (Kontakt-Inbox)

## Einrichtung (automatisch)

Beim WhatsApp-Verbinden (`syncWhatsappFromWaha`) wird pro Restaurant-Session konfiguriert:

- **URL:** `https://<SITE>/api/integrations/waha/webhook` (`NEXT_PUBLIC_SITE_URL` / `getPublicSiteUrl()`)
- **Events:** `message` (eingehend)
- **Metadata:** `gwada.restaurant_id` = Restaurant-UUID
- **Update:** `wahaUpdateSessionWebhooks` bei Connect und Session-Restart

Optional in `.env` / Production:

- `WAHA_WEBHOOK_HMAC_KEY` — HMAC-SHA512, Header `X-Webhook-Hmac` (ohne Key: Verifikation aus)

## Ablauf bei eingehender Nachricht

1. WAHA POST → `/api/integrations/waha/webhook`
2. **Verknüpfter Kontakt:** Spiegel in `contact_messages` (`platform: whatsapp`) → Supabase Realtime
3. **Nicht verknüpft (nur WAHA-Chat):** Eintrag in `restaurant_inbox_signals` (`source: waha`) → Realtime
4. Client (Dashboard + Kontakte): debounced leiser Inbox-Refresh — **kein** 5-Min-Polling nötig solange Realtime läuft
5. Fallback: 5-Min-Polling nur wenn Realtime nicht verbindet

## Fallbacks

- Cron `GET /api/cron/contact-inbox-sync`
- Manueller Refresh in der Nachrichten-Übersicht
- 5-Min-Hintergrund-Sync (`useUnifiedInboxBackgroundSync`)
