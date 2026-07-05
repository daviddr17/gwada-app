# Live-App deployen (gwada.app)

**Production-Domain:** `https://gwada.app` — Domain-Architektur: [gwada-app-domains.md](./gwada-app-domains.md)

Coolify kann Deployments als **finished** markieren, während `gwada.app` noch ein **altes Docker-Image** ausliefert (z. B. festes Tag `:live-proxy` in `docker-compose.yaml`).

## Standard (GitHub Actions)

```bash
git push origin main
gh workflow run deploy-live-app.yml --ref main
gh run watch --workflow=deploy-live-app.yml --exit-status
curl -s https://gwada.app/api/build-info
```

## Manuell (SSH + Skript)

```bash
bash scripts/vps-deploy-live-app.sh
```

Env patchen ohne Full-Deploy:

```bash
APP_ORIGIN=https://gwada.app bash scripts/coolify-env-live-proxy.sh
```

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
| 503 auf gwada.app | Traefik Host-Rule fehlt | `COOLIFY_FQDN=gwada.app bash scripts/vps-ensure-coolify-traefik-fqdn.sh` |
| Auth-Redirect-Fehler | GoTrue SITE_URL | `APP_ORIGIN=https://gwada.app bash scripts/vps-patch-gotrue-redirects.sh` |

Siehe auch [live-deploy.md](./live-deploy.md).
