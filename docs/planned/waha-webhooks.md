# Geplant: WAHA-Webhooks (wenn Live-Domain steht)

- Öffentliche URL: `https://<GWADA-LIVE-DOMAIN>/api/integrations/waha/webhook`
- Events: `session.status`, später `message` / `message.any`
- WAHA-Session beim Verbinden mit Webhook-URL + Metadata `gwada.restaurant_id`
- Danach: Session-Status ohne Polling; Nachrichten-Empfang in Schritt 2

Bis dahin: Polling für QR/Status, Reservierungs-WhatsApp per `sendText` + Outbox-Cron.
