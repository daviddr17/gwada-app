# Live-App deployen (new.gwada.app)

## Problem

Coolify kann Deployments als **finished** markieren, während `new.gwada.app` noch ein **altes Docker-Image** ausliefert (z. B. festes Tag `:live-proxy` in `docker-compose.yaml`).

## Lösung

Jeder Push auf `main` baut ein Image mit **Git-SHA-Tag**, tauscht den Container per `docker compose up --force-recreate` aus und prüft `/api/build-info`.

| Weg | Wann |
|-----|------|
| **GitHub Action** `deploy-live-app.yml` | Automatisch bei Push auf `main` (wenn Secrets gesetzt) |
| **`npm run deploy:app:live`** | Manuell vom Mac nach Push |

## Einmalig: GitHub Secrets

Repository → Settings → Secrets → Actions:

| Secret | Inhalt |
|--------|--------|
| `LIVE_SSH_KEY` | Privater SSH-Key (`~/.ssh/id_ed25519`), der auf dem VPS root-Zugang hat |
| `LIVE_VPS_HOST` | `95.111.229.250` |

Optional lokal: `ssh-copy-id root@95.111.229.250`

## Manuell deployen

```bash
ssh-add --apple-use-keychain ~/.ssh/id_ed25519   # falls nötig
npm run deploy:app:live
npm run deploy:app:live:verify                  # → {"sha":"848f3f6"}
```

## Live-Stand prüfen

```bash
curl -s https://new.gwada.app/api/build-info
git rev-parse --short HEAD   # sollte übereinstimmen
```

## Coolify

- Coolify kann für SSL/Domain/Env bleiben.
- **Auto-Deploy optional deaktivieren**, wenn die GitHub Action aktiv ist (vermeidet parallele Builds).
- **Nicht** wieder manuell `:live-proxy` o. Ä. in `docker-compose.yaml` pinnen.
