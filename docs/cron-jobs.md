# Cron-Jobs (Live)

Ersetze `https://gwada.app` durch deine Live-Domain, falls abweichend.

Alle Cron-Routen erwarten Header:

```http
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` in Coolify / `.env.production` und in GitHub Actions (`production-cron.yml`, `notification-deliver-cron.yml`).

## GitHub Actions (empfohlen)

- `production-cron.yml` — Feed-Syncs, Staff-Shift, Kontakte, Lexoffice, **Reservierungs-Erinnerung/Danke** (WhatsApp + E-Mail Outbox)
- `notification-deliver-cron.yml` — Push/WhatsApp/E-Mail-Zustellung (Staff/In-App-Notifications)

`CRON_BASE_URL: https://gwada.app` in den Workflows.

## Manuell (curl)

```bash
CRON_SECRET=…

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/news-feed-sync

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/reviews-feed-sync

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/notification-deliver

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/newsletter-send

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/staff-shift-notifications

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/contact-inbox-sync

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/accounting-lexoffice-sync

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/social-suggestions

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/reservation-whatsapp

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/reservation-email
```

### Reservierungen: Erinnerung / Danke & Bewertung

Geplante Nachrichten liegen in `reservation_whatsapp_outbox` / `reservation_email_outbox`.
Die Settings-Toggles allein versenden nicht — der Cron muss fällige Zeilen drainen (alle 5 Min. über `production-cron.yml`).
