# WAHA-Webhooks (Kontakt-Inbox)

- URL: `https://<SITE>/api/integrations/waha/webhook` (`NEXT_PUBLIC_SITE_URL` / Runtime-Origin)
- Event: `message` (eingehend) → Kontakt per Telefonnummer → `contact_messages` mit `platform: whatsapp`
- Session: beim Connect/Update `wahaUpdateSessionWebhooks`, Metadata `gwada.restaurant_id`
- Optional: `WAHA_WEBHOOK_HMAC_KEY` (HMAC-SHA512, Header `X-Webhook-Hmac`)
- Fallback: Cron `GET /api/cron/contact-inbox-sync` + Client-Polling im Gwada-Thread (45s)
