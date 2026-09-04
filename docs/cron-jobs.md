# Cron-Jobs (Live)

Der **VPS** plant und führt alle Produktions-Crons aus. GitHub Actions hat **kein** `schedule` mehr.

Alle Cron-Routen erwarten Header:

```http
Authorization: Bearer <CRON_SECRET>
```

`CRON_SECRET` steht in der Coolify-`.env` (liest die Host-Crontab). In GitHub Actions nur noch für manuellen Notfall-Dispatch.

## Scheduler

Host-Crontab auf dem Live-VPS, installiert mit:

```bash
gh api repos/daviddr17/gwada-app/dispatches -f event_type=install-vps-critical-cron
```

Skript: `scripts/install-vps-critical-cron.sh` (liest `CRON_SECRET` aus Coolify `.env`).
Logs: `/var/log/gwada-cron/*.log` auf dem VPS.

| Takt (UTC) | Endpoint |
|---|---|
| `*/5` | `reservation-whatsapp`, `reservation-email`, `staff-shift-notifications`, `waha-session-recover`, `reservation-whatsapp-slo`, `contact-inbox-sync`, `newsletter-send`, `news-publish` |
| `*/2` | `notification-deliver` |
| `*/10` | `news-feed-sync`, `reviews-feed-sync`, `accounting-lexoffice-sync` |
| `0 6 * * *` | `billing-past-due` |
| `0 7 * * 1` | `social-suggestions` |

On-Call-Mails nur bei Lag der **Zustell-Crons** (WhatsApp/E-Mail/Push/SLO/WAHA-Recover), nicht bei Sync-Jobs.

## GitHub Actions (nur manuell)

- `production-cron.yml` — `workflow_dispatch` / `repository_dispatch`, kein Timer
- `notification-deliver-cron.yml` — `workflow_dispatch`, kein Timer
- `install-vps-critical-cron.yml` — schreibt die Host-Crontab

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

curl -fsS -H "Authorization: Bearer $CRON_SECRET" \
  https://gwada.app/api/cron/news-publish
```

Abo: täglich 06:00 UTC Stripe gegen die DB (verpasste Webhooks, Status, 7-Tage-Cutoff). `news-feed-sync` kann denselben Sweep zusätzlich auslösen, wenn er fällig ist.

### Reservierungen: Erinnerung / Danke & Bewertung

Geplante Nachrichten liegen in `reservation_whatsapp_outbox` / `reservation_email_outbox`.
Die Settings-Toggles allein versenden nicht — der VPS-Cron draint fällige Zeilen alle 5 Minuten.

Zeilen, die **>36 Stunden** nach `send_at` noch ungesendet sind, werden als `too_late` abgebrochen (kein Nachholen Tage später). Erinnerungen nach Terminbeginn ebenfalls.
