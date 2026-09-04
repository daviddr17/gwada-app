# CRON_SECRET rotieren (Live)

GitHub Actions und die VPS-Crontab müssen **denselben** Secret haben. Nur auf einer Seite drehen legt die Crons tot.

**Nicht** den Secret in Logs, Issues oder Chat schreiben.

## Ablauf (David)

1. Neuen Secret erzeugen, z. B. `openssl rand -hex 32`.
2. In GitHub → Repo **Settings → Secrets → `CRON_SECRET`** den **neuen** Wert setzen (überschreiben).
3. Danach **einen** Workflow starten:

```bash
gh api repos/daviddr17/gwada-app/dispatches \
  --input - <<'EOF'
{"event_type":"rotate-cron-secret","client_payload":{"ref":"main"}}
EOF
```

Oder GitHub Actions: **Rotate CRON secret live**.

Der Workflow macht nacheinander:

1. `scripts/sync-cron-secret-live.sh` — schreibt `CRON_SECRET` in die Coolify-`.env` und startet die App neu
2. `scripts/install-vps-critical-cron.sh` — schreibt die Host-Crontab neu (liest den Secret aus derselben `.env`)

4. Prüfen (ohne Secret auszugeben):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  -H "Authorization: Bearer <NEUER_SECRET>" \
  https://gwada.app/api/cron/reservation-whatsapp-slo
```

Erwartet: `200`. Alter Secret → `401`.

## Slack / Telegram (nächster Schritt)

On-Call ist E-Mail an Superadmins, alle 10 Minuten mit Betreff `ESKALATION` ab der 2. Mail — nur bei SLO-Bruch (24h, WAHA WORKING), hängendem Versand oder Lag der Zustell-Crons. GitHub-Sync-Lag (Inbox/News/Reviews/…) löst keine Mail aus. Ein Slack-/Telegram-Webhook kommt als eigene Platform-Integration — nicht über `.env`.
