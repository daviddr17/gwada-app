# Cron-Jobs (Live)

Ersetze `https://gwada.app` durch deine Live-Domain, falls abweichend.

Alle Cron-Routen erwarten Header:

```http
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` in Coolify / `.env.production` und in GitHub Actions (`production-cron.yml`, `notification-deliver-cron.yml`).

## Zuverlässigkeit (wichtig)

GitHub Actions **`schedule` ist unzuverlässig** — oft nur alle paar Stunden statt alle 5 Minuten.
Zeitkritische Jobs (Reservierungs-WhatsApp/E-Mail, Notification-Deliver, Schicht-Push, WAHA-Recover) laufen deshalb **zusätzlich als Host-Crontab auf dem VPS**:

```bash
# Einmalig / nach Secret-Sync:
gh workflow run install-vps-critical-cron.yml
# oder:
gh api repos/<org>/<repo>/dispatches -f event_type=install-vps-critical-cron
```

Skript: `scripts/install-vps-critical-cron.sh` (liest `CRON_SECRET` aus Coolify `.env`).
Logs: `/var/log/gwada-cron/*.log` auf dem VPS.

GitHub Actions bleibt als Backup / manuelles Triggern (`workflow_dispatch` / `repository_dispatch`).

## GitHub Actions

- `production-cron.yml` — Feed-Syncs, Staff-Shift, Kontakte, Lexoffice, **Reservierungs-Erinnerung/Danke** (WhatsApp + E-Mail Outbox)
- `notification-deliver-cron.yml` — Push/WhatsApp/E-Mail-Zustellung (Staff/In-App-Notifications)
- `install-vps-critical-cron.yml` — Host-Crontab für die zeitkritischen Endpoints

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

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/billing-past-due
```

Abo: einmal täglich gegen 06:00 UTC Stripe gegen die DB (verpasste Webhooks, Status, 7-Tage-Cutoff). Manuell: `/api/cron/billing-past-due`.

### Reservierungen: Erinnerung / Danke & Bewertung

Geplante Nachrichten liegen in `reservation_whatsapp_outbox` / `reservation_email_outbox`.
Die Settings-Toggles allein versenden nicht — der Cron muss fällige Zeilen drainen (alle 5 Min. über VPS-Crontab + `production-cron.yml`).

Zeilen, die **>36 Stunden** nach `send_at` noch ungesendet sind, werden als `too_late` abgebrochen (kein Nachholen Tage später). Erinnerungen nach Terminbeginn ebenfalls.
