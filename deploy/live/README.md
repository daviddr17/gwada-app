# Live-Stack: Compose + Caddy

Zielverzeichnis auf dem VPS: **`/opt/gwada/live`**.

Migration und Rollback: Agent-Store-Runbook  
`docs/coolify-to-caddy-migration.md` (Projekt-Context) bzw. Repo nach Merge.

## Kurz

```bash
# Auf dem VPS (nach Cutover-Skript / manuell)
cd /opt/gwada/live
docker compose pull app
docker compose up -d
curl -s https://gwada.app/api/build-info
```

Deploy bleibt GitHub Actions → `scripts/vps-deploy-live-app.sh` (preferiert dieses Verzeichnis).
