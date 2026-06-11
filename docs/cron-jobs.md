# Cron-Jobs (Live-VPS)

Alle Endpunkte erwarten `Authorization: Bearer $CRON_SECRET` (Wert aus Coolify/`.env`).

Ersetze `https://new.gwada.app` durch die Live-Domain.

## Externe Feeds (Cache, ~10 Min. pro Restaurant)

News und Bewertungen werden in Postgres gecacht. Der Cron füllt den Cache im Hintergrund; Reads triggern bei Bedarf stale-on-read (>10 Min.).

```bash
# News (Facebook, Instagram, Google Business, WhatsApp-Kanal)
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/news-feed-sync

# Bewertungen (Google, Facebook) — gestaffelt per Restaurant-Hash über 10 Min.
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/reviews-feed-sync
```

**Intervall:** alle **10 Minuten** (z. B. `*/10 * * * *`).

**Stale-Schwellwert:** `NEWS_CACHE_STALE_MS` / `REVIEWS_CACHE_STALE_MS` = 10 Min.

## Push-Benachrichtigungen (Outbox)

```bash
curl -sS -H "Authorization: Bearer $CRON_SECRET" \
  https://new.gwada.app/api/cron/notification-deliver
```

**Intervall:** alle **1–2 Minuten**.

## Nicht cachen (live bleiben)

- **Kontakte / Nachrichten** — WAHA + IMAP (`/api/cron/contact-inbox-sync`), unverändert live.

## Architektur (Kurz)

| Quelle | Strategie |
|--------|-----------|
| News (extern) | DB-Cache + stale-on-read + 10-Min-Cron |
| Bewertungen (Google/Facebook) | DB-Cache + stale-on-read + 10-Min-Cron (gestaffelt) |
| Gwada-Bewertungen / Gwada-News | Direkt aus DB |
| Nachrichten | Live-Sync (WAHA/IMAP) |
| Profil/Embed/Public-API | Cache lesen + ISR `s-maxage=60` |

**Rate-Limits:** Cache entlastet Reads; Sync nutzt pro Plattform Timeouts und Fehler in `*_platform_sync.last_error`. Reviews-Cron staffelt Restaurants per `hash(restaurant_id) % 10` über den 10-Minuten-Zyklus.
