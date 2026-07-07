# Live-App deployen (gwada.app)

**Production-Domain:** `https://gwada.app` — Domain-Architektur: [gwada-app-domains.md](./gwada-app-domains.md)

## Ablauf (seit 2026-07)

1. **GitHub Actions** baut das Docker-Image (Buildkit + GHA-Cache) und pusht nach **`ghcr.io/daviddr17/gwada-app:<sha>`**
2. **VPS** pullt nur noch das Image und startet den Coolify-Container neu (~2–4 Min.)

Kein `docker build` mehr auf dem VPS — damit entfallen OOM/Timeout beim TypeScript-Check auf dem kleinen Server.

## Standard (GitHub Actions)

```bash
git push origin main
gh workflow run deploy-live-app.yml --ref main
gh run watch --workflow=deploy-live-app.yml --exit-status
curl -s https://gwada.app/api/build-info
```

Workflow: `.github/workflows/deploy-live-app.yml` — Jobs **`Build image (GHA)`** + **`Pull on VPS`**.

## Manuell (lokal)

Nur Pull auf VPS (Image muss bereits auf GHCR existieren):

```bash
GWADA_DEPLOY_IMAGE=ghcr.io/daviddr17/gwada-app:$(git rev-parse --short HEAD) npm run deploy:app:live
```

Build + Push + Deploy lokal:

```bash
GWADA_DEPLOY_BUILD_PUSH=1 npm run deploy:app:live
```

Voraussetzung Pull: `GWADA_GITHUB_DEPLOY_TOKEN` mit **`read:packages`** (GitHub Secret, wird auf dem VPS für `docker login ghcr.io` genutzt).

Optional: GitHub Secret **`LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY`** — sonst liest der Build-Job den Anon-Key aus der Coolify-`.env` auf dem VPS.

## Verifikation

```bash
curl -s https://gwada.app/api/build-info
# → {"sha":"<commit>"}
```

SHA muss dem gewünschten `git rev-parse --short HEAD` entsprechen.

## Häufige Probleme

| Symptom | Ursache | Fix |
|---------|---------|-----|
| Alter SHA in build-info | Container/Image nicht getauscht | `deploy-live-app.yml` erneut |
| `denied` beim docker pull | GHCR-Token ohne `read:packages` | PAT aktualisieren, `sync-github-deploy-token-live.yml` |
| Superadmin „Deploy konnte nicht gestartet werden“ | `GITHUB_DEPLOY_TOKEN` fehlt im Container oder PAT ohne `repo`/`workflow` | Secret `GWADA_GITHUB_DEPLOY_TOKEN` (repo + read:packages), `sync-github-deploy-token-live.yml`; Superadmin nutzt bei fehlendem `workflow`-Scope `repository_dispatch` |
| Build-Job: anon key fehlt | Weder Secret noch VPS-.env | `LIVE_NEXT_PUBLIC_SUPABASE_ANON_KEY` setzen |
| 503 auf gwada.app | Traefik Host-Rule fehlt | `COOLIFY_FQDN=gwada.app bash scripts/vps-ensure-coolify-traefik-fqdn.sh` |

Siehe auch [live-deploy.md](./live-deploy.md).
