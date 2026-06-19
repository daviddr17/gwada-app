# Cron-Jobs (Live)

Alle Endpunkte erwarten `Authorization: Bearer $CRON_SECRET` (Wert aus Coolify/`.env` bzw. GitHub Secret `CRON_SECRET`).

Ersetze `https://new.gwada.app` durch die Live-Domain.

## Automatisierung (GitHub Actions)

| Endpunkt | Intervall | Workflow |
|----------|-----------|----------|
| `/api/cron/notification-deliver` | alle **2 Min.** | `.github/workflows/notification-deliver-cron.yml` (eigener Job, zuverlässig) |
| `/api/cron/news-feed-sync` | alle **10 Min.** | `.github/workflows/production-cron.yml` |
| `/api/cron/reviews-feed-sync` | alle **10 Min.** | `.github/workflows/production-cron.yml` |
| `/api/cron/staff-shift-notifications` | alle **5 Min.** | `.github/workflows/production-cron.yml` |
| `/api/cron/contact-inbox-sync` | alle **5 Min.** | `.github/workflows/production-cron.yml` |
| `/api/cron/accounting-lexoffice-sync` | alle **10 Min.** | `.github/workflows/production-cron.yml` |

**Push-Versand:** Der Worker arbeitet pro Lauf bis zu **110 s** die Event-Queue und Delivery-Queue ab (Batch 50/30). Antwort enthält `pendingEventsRemaining`, `pendingDeliveriesRemaining`, `timedOut` — bei `timedOut: true` und Rest &gt; 0 nächster Lauf in 2 Min.

- **Secret:** `CRON_SECRET` in GitHub Repository Secrets (gleicher Wert wie auf dem VPS).
- **Manuell:** Actions → „Notification deliver cron“ oder „Production cron jobs“ → **Run workflow**.
- Ohne gesetztes Secret: Push-Cron schlägt fehl (`exit 1`); übrige Crons in `production-cron.yml` werden übersprungen (`exit 0`).

## VPS-Fallback (manuell / Coolify-Cron)

Wenn GitHub Actions ausfällt oder ein Endpunkt lokal getestet werden soll:

```bash
# News (Facebook, Instagram, Google Business, WhatsApp-Kanal)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/news-feed-sync

# Bewertungen (Google, Facebook) — gestaffelt per Restaurant-Hash über 10 Min.
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/reviews-feed-sync

# Push-Benachrichtigungen (Outbox)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/notification-deliver

# Schichtbeginn/-ende
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/staff-shift-notifications

# Kontakte / Nachrichten (WAHA + IMAP)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/contact-inbox-sync

# Buchführung (Lexoffice: Belege, Rechnungen, Angebote → DB)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/accounting-lexoffice-sync
```

**Stale-Schwellwert (News/Reviews):** `NEWS_CACHE_STALE_MS` / `REVIEWS_CACHE_STALE_MS` = 10 Min.

## Weitere Crons (nicht im Production-Workflow)

Diese Endpunkte existieren, werden aber **nicht** von `production-cron.yml` angestoßen — bei Bedarf VPS-Cron oder manuell:

- `/api/cron/reservation-email` — Reservierungs-E-Mails
- `/api/cron/reservation-whatsapp` — Reservierungs-WhatsApp
- `/api/cron/news-publish` — geplante News-Veröffentlichung

## Architektur (Kurz)

| Quelle | Strategie |
|--------|-----------|
| News (extern) | DB-Cache + stale-on-read + 10-Min-Cron |
| Bewertungen (Google/Facebook) | DB-Cache + stale-on-read + 10-Min-Cron (gestaffelt) |
| Gwada-Bewertungen / Gwada-News | Direkt aus DB |
| Nachrichten | Live-Sync (WAHA/IMAP) |
| Profil/Embed/Public-API | Cache lesen + ISR `s-maxage=60` |

**Rate-Limits:** Cache entlastet Reads; Sync nutzt pro Plattform Timeouts und Fehler in `*_platform_sync.last_error`. Reviews-Cron staffelt Restaurants per `hash(restaurant_id) % 10` über den 10-Minuten-Zyklus.
