# Live-App deployen (new.gwada.app)

## Problem

Coolify kann Deployments als **finished** markieren, während `new.gwada.app` noch ein **altes Docker-Image** ausliefert (z. B. festes Tag `:live-proxy` in `docker-compose.yaml`).

## Lösung

Nach **Commit + Push auf `main`** wird live **nicht** automatisch aktualisiert. Deploy startest du bewusst — z. B. Superadmin → **Live & Deploy** → **DB deployen** (bei Migrationen) → **App deployen**. Die Action baut ein Image mit **Git-SHA-Tag**, tauscht den Container per `docker compose up --force-recreate` aus und prüft `/api/build-info`.

| Weg | Wann |
|-----|------|
| **Superadmin** → DB / App deployen | Standard nach Push auf `main` (`GITHUB_DEPLOY_TOKEN` in App-Env) |
| **GitHub Action** `deploy-live-app.yml` / `deploy-live-db.yml` | Nur `workflow_dispatch` (manuell oder per API) |
| **`npm run deploy:app:live`** | Alternativ App-Deploy vom Mac |

## Superadmin → Datenbank

Unter **Live-App & Deployment** siehst du:

- **Live ist aktuell / veraltet / Deploy läuft** — Vergleich öffentliche `/api/build-info` vs. GitHub `main`
- **GitHub Actions** — letzter Lauf und Link zu den Logs
- **Deploy starten** — löst `deploy-live-app.yml` per API aus (benötigt `GITHUB_DEPLOY_TOKEN` in Coolify)

Env auf dem VPS (Coolify App):

| Variable | Zweck |
|----------|--------|
| `GITHUB_DEPLOY_TOKEN` | Deploy-Button + Actions-Status in der UI |
| `COOLIFY_API_TOKEN` | Coolify-Deploy-Status in der UI |
| `GWADA_COOLIFY_APP_UUID` | Coolify-App |

GitHub Repository Secrets (für SSH-Deploy):

| Secret | Inhalt |
|--------|--------|
| `LIVE_SSH_KEY` | Privater SSH-Key (`~/.ssh/id_ed25519`), der auf dem VPS root-Zugang hat |
| `LIVE_VPS_HOST` | `95.111.229.250` |
| `GWADA_GITHUB_DEPLOY_TOKEN` | PAT für Superadmin Deploy-Buttons (wird als `GITHUB_DEPLOY_TOKEN` in die App-Env geschrieben) |

Optional lokal: `ssh-copy-id root@95.111.229.250`

Das Secret `GWADA_GITHUB_DEPLOY_TOKEN` landet beim App-Deploy automatisch als `GITHUB_DEPLOY_TOKEN` in der Coolify-`.env` — kein manuelles Eintragen in der Coolify-UI nötig.

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

## Coolify (Zusammenspiel)

Coolify **bleibt** für SSL, Domain, Env-Variablen und das Compose-Verzeichnis unter `/data/coolify/applications/…`.

Der Deploy-Script **ersetzt nur die Image-Zeile** (`image: '<app-uuid>:<git-sha>'`) und führt `docker compose up -d --force-recreate` **im bestehenden Coolify-Compose** aus — kein zweites Setup, kein Port-Wechsel.

| Coolify | GitHub Action / `npm run deploy:app:live` |
|---------|-------------------------------------------|
| Domain, TLS, Env, Netzwerk | Baut Image + tauscht Container |
| Optional: Status in Superadmin-UI | **Autoritativer** App-Deploy |
| Auto-Deploy bei Git-Push | **Deaktiviert** — Deploy nur manuell (Superadmin oder `gh workflow run`) |

- Lock-Datei `/tmp/gwada-deploy-live-app.lock` verhindert gleichzeitige Deploys.
- **Nicht** wieder manuell `:live-proxy` o. Ä. in `docker-compose.yaml` pinnen.
