# Live deploy (App + DB)

Production: **`https://gwada.app`** — Domain: [gwada-app-domains.md](./gwada-app-domains.md).

## Einziger Standardweg

Nach `git push origin main` — **eine** der Varianten (alle landen in denselben Workflows):

| Wer | Befehl / UI |
|-----|-------------|
| **Agent / CLI** | `gh workflow run deploy-live-full.yml --ref main` dann `gh run watch --workflow=deploy-live-full.yml --exit-status` |
| **Einzeln** | `deploy-live-db.yml` → danach `deploy-live-app.yml` |
| **Superadmin** | Buttons **DB deployen** / **App deployen** (`repository_dispatch`) |

Prüfen: `curl -s https://gwada.app/api/build-info` → `sha` = gewünschter Commit.

`deploy-live-full` **ruft** `deploy-live-db` + `deploy-live-app` auf (kein paralleler Code). Details App: [coolify-live-deploy.md](./coolify-live-deploy.md).

### Cloud-Agent

1. `git pull` / aktueller `main` — **nicht** mit veraltetem Checkout deployen.
2. Code pushen, dann **`gh workflow run deploy-live-full.yml --ref main`** (oder Superadmin).
3. **Nicht** lokal Passwörter/Keys „reparieren“, **nicht** Coolify-Webhook, **nicht** `npm run deploy:live` als Standard.

Der Push-Trigger `.github/triggers/deploy-live.env` ist nur Fallback; bevorzugt `workflow_dispatch` / Superadmin.

## GitHub Repository Secrets (Pflicht / optional)

| Secret | Pflicht | Rolle |
|--------|---------|--------|
| `LIVE_SSH_KEY` | ja | privater SSH-Key → VPS |
| `LIVE_VPS_HOST` | ja | z. B. `95.111.229.250` |
| `GWADA_GITHUB_APP_ID` / `_INSTALLATION_ID` / `_PRIVATE_KEY` | ja für Superadmin-Deploy | kurzlebige Tokens, kein ablaufender PAT — [github-app-deploy-auth.md](./github-app-deploy-auth.md) |
| `LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY` | optional | sonst aus Coolify-`.env` auf dem VPS |
| `GWADA_GITHUB_DEPLOY_TOKEN` | optional | PAT-Fallback / Sync; GHCR-Pull in CI nutzt `GITHUB_TOKEN` |
| `CRON_SECRET` | optional für Deploy | Cron im Container |

**Kein** Secret „Postgres-Passwort“ in GitHub nötig: CI liest per SSH den funktionierenden Wert aus Coolify-Compose (Container-Env allein kann veraltet sein).

### Live-Daten (Inhalt) — getrennt vom Schema-Deploy

| Befehl | Wirkung | Pflicht-Flag |
|--------|---------|--------------|
| `deploy-live-full` / `deploy-live-db` | nur Schema | — (nach „live deployen“) |
| `pnpm sync:live:data` / `deploy:live:full` | **Truncate + Restore lokal → Live** | `GWADA_CONFIRM_LIVE_DATA=1` |

Ohne Flag: sofortiger Abbruch (`scripts/require-live-data-confirm.sh`). Nie aus Versehen ältere lokale Daten auf Live spielen.

Preflight Schema/SSH: `scripts/ci-live-secrets-preflight.sh` (am Start von DB-/App-Deploy).

## Typische Fehlermeldungen (nicht hin und her raten)

| Symptom | Ursache | Fix |
|---------|---------|-----|
| `password authentication failed for user "postgres"` | Alter Deploy ohne Compose-Passwort-Probe | Aktuellen `main` deployen (`deploy-db-live-ci.sh` mit Kandidaten) |
| `LIVE_SSH_KEY / LIVE_VPS_HOST fehlen` | Repo-Secrets | In GitHub Secrets setzen |
| `denied` beim docker pull | Token ohne `read:packages` | CI nutzt `GITHUB_TOKEN`; VPS: IPv4-Pin + gültiger Pull-Token |
| Superadmin „Deploy konnte nicht gestartet werden“ | GitHub App fehlt/kaputt im Container | `sync-github-app-credentials-live.yml` |
| Alter SHA in build-info | App-Deploy nicht durch | `deploy-live-app` erneut, Log prüfen |

## Domain-Cutover (einmalig)

```bash
bash scripts/vps-cutover-production-domain.sh
gh workflow run deploy-live-app.yml --ref main
```

DNS bei IONOS: `gwada.app` → VPS, `old.gwada.app` → Bubble.
