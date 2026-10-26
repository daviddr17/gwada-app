# Coolify → Docker Compose + Caddy (Live-VPS)

**Ziel:** Coolify-Control-Plane (UI + Traefik) entfernen. Live bleibt auf Contabo `95.111.229.250` / `gwada.app`. Deploy weiter über GitHub Actions (`deploy-live-*` → GHCR → `docker compose pull/up`). TLS + Reverse-Proxy wie bei Musterungsfuchs: **Caddy**.

**Stand:** 26. Oktober 2026 · **Cutover erfolgreich** · Edge = **Caddy** · Coolify-Control-Plane **gestoppt** · `build-info` weiter `451bc4a`.

---

## Kurzentscheidung

| Thema | Entscheidung |
|-------|----------------|
| App-Image | unverändert `ghcr.io/daviddr17/gwada-app:<sha>` |
| Deploy | GH Actions; VPS nur Pull + `compose up` (kein Coolify-API) |
| Proxy/TLS | Caddy (80/443), ersetzt Coolify-Traefik |
| Supabase/Postgres | Container **laufen lassen**; Compose unter Coolify-Services zunächst belassen, nur aus Traefik herauslösen |
| Studio/Auth | `studio.new.gwada.app` / `auth.new.gwada.app` über Caddy (+ Authelia `forward_auth`) |
| Coolify UI | erst **nach** grünem Verify stoppen/entfernen |
| Dev-DB | `/opt/gwada-supabase-dev` — **nicht** anfassen |

---

## Ist-Zustand (Inventur 2026-10-26, VPS)

| Baustein | Live-Befund |
|----------|-------------|
| Host | `vmd197731` · Kernel 6.8 · up ~7d |
| App | Container `d3cg1b54arvue2tcm8u34qty-211008998242` · Image `ghcr.io/daviddr17/gwada-app:451bc4a` · `127.0.0.1:3000` |
| App-Compose | `/data/coolify/applications/d3cg1b54arvue2tcm8u34qty/` |
| Proxy | `coolify-proxy` = **Traefik v3.6** auf `0.0.0.0:80/443` (+ UDP 443) |
| Coolify UI | `coolify:4.1.2` · Port **8000** derzeit WAN (`0.0.0.0:8000→8080`) |
| Live-Supabase | Service `oogd5syyxiqb1k4g0wy1u9n8` · Kong/DB/Studio/Auth **healthy** |
| Authelia | `authelia-gwada` + `gwada-studio-gateway` · `/data/coolify/services/authelia-gwada/` |
| Netze | `coolify`, `oogd5syyxiqb1k4g0wy1u9n8`, `gwada-dev_default`, `supabase_default` |
| `/opt/gwada/live` | **fehlt** (Cutover legt an) |
| Dev-Supabase | `/opt/gwada-supabase-dev` · mehrere Container **Restarting** (bestehend; Cutover fasst nicht an) |
| build-info | `{"sha":"451bc4a"}` |

Roh-Log: `internal/coolify-live-inventory-2026-10-26.txt` · Workflow-Run [40324922126](https://github.com/daviddr17/gwada-app/actions/runs/40324922126).

Inventur-Skript: `scripts/vps-inventory-coolify-live.sh` · Workflow `inventory-live-vps.yml`.

---

## Ziel-Layout auf dem VPS

```text
/opt/gwada/live/
  docker-compose.yml   # caddy + app
  Caddyfile
  .env                 # aus Coolify-App-.env kopiert (Secrets bleiben auf dem Server)
  README.md
```

- **Caddy** published `80`/`443` (ersetzt Traefik-Bind).
- **App** nur intern Port 3000; Netze: `gwada_live` + externes Supabase-Netz `oogd5syyxiqb1k4g0wy1u9n8`.
- Supabase-/Authelia-Container bleiben; Authelia muss für Caddy erreichbar sein (Netz `coolify` oder gemeinsames Netz).

Repo-Vorlagen: `deploy/live/` (werden nach `/opt/gwada/live` synchronisiert).

---

## Was sich in Deploy-Skripten ändert

| Vorher (Coolify) | Nachher (Compose+Caddy) |
|------------------|-------------------------|
| `COMPOSE_DIR=/data/coolify/applications/<uuid>` | Prefer `/opt/gwada/live` wenn vorhanden |
| Traefik-Labels patchen (`vps-ensure-coolify-traefik-fqdn.sh`) | entfällt für App-Deploy |
| Image in Coolify-Compose sed’en | Image in `/opt/gwada/live/docker-compose.yml` setzen + `docker compose up -d app` |
| `ci-read-live-build-env.sh` liest Coolify-`.env` | liest zuerst `/opt/gwada/live/.env`, Fallback Coolify |
| Sync-Skripte (`sync-cron-secret-live`, GitHub App, …) | Ziel-`.env` = Live-Compose-Dir |

Fallback: Solange `/opt/gwada/live` fehlt, bleibt der alte Coolify-Pfad aktiv (kein Big-Bang im Skript).

---

## Voraussetzungen / Blocker

1. **`LIVE_SSH_KEY` + `LIVE_VPS_HOST`** in GitHub Actions (bereits für Deploy) — Cutover/Inventur laufen darüber.
2. **Cloud-Agent:** Secret `SSH_PRIVATE_KEY` ist nur `gwada-local-deploy` → **Permission denied** auf Live. Für direkten Agent-SSH: denselben Key wie `LIVE_SSH_KEY` als Agent-Secret hinterlegen **oder** Cutover nur per Workflow.
3. **Contabo-Snapshot vor Cutover (Pflicht):** Daily-Snapshots-API (PR #576) ohne `CONTABO_CLIENT_ID` / `CONTABO_API_PASSWORD` → **manuell** in Contabo UI Snapshot von `95.111.229.250` erstellen, danach Cutover bestätigen.
4. Keine parallelen `deploy-live-*` während Cutover.

---

## Ablauf (Reihenfolge)

### 0. Inventur (read-only)

```bash
gh workflow run inventory-live-vps.yml --ref <branch>
# oder nach Merge: --ref main
```

Erfasst: `docker ps`, Coolify-Apps/Services, Compose-Pfade, Traefik/Caddy-Ports, Supabase-Container, App-Image, **keine** Secret-Werte.

### 1. Snapshot

Contabo → Instance → Snapshot (Name z. B. `pre-caddy-YYYYMMDD`). Ohne Snapshot **kein** Cutover.

### 2. Dateien auf VPS vorbereiten (noch ohne Port-Übernahme)

Per SSH / Cutover-Skript:

- `/opt/gwada/live` anlegen
- Compose + Caddyfile aus Repo
- `.env` aus `/data/coolify/applications/d3cg1b54arvue2tcm8u34qty/.env` kopieren (Rechte 600)
- App-Image-Tag = aktueller Live-SHA (`build-info`)
- Docker-Netze prüfen (`oogd5syyxiqb1k4g0wy1u9n8`, ggf. `coolify` für Authelia)

Noch **kein** Caddy auf 80/443, wenn Traefik noch bindet — Skript stoppt Traefik erst im Cutover-Schritt.

### 3. Cutover (kurze Wartung, typ. &lt; 2 Min Edge)

Gated: `GWADA_CONFIRM_CADDY_CUTOVER=CUTOVER` und `GWADA_SNAPSHOT_DONE=yes`.

1. Coolify-Traefik/Proxy stoppen (Ports 80/443 frei).
2. Coolify-App-Container stoppen (Doppel-Bind/Konflikt vermeiden); **Supabase nicht stoppen**.
3. `docker compose -f /opt/gwada/live/docker-compose.yml up -d`
4. TLS-Ausgabe Caddy abwarten; prüfen:
   - `curl -s https://gwada.app/api/build-info` → erwarteter SHA
   - Login App
   - `curl -sI https://studio.new.gwada.app` → 302 Authelia
   - `curl -sI https://auth.new.gwada.app` → 200
   - DB: bestehender `/sb`-Pfad / Studio nach Login

Skript: `scripts/vps-cutover-coolify-to-caddy.sh`  
Workflow: `cutover-coolify-to-caddy.yml` (workflow_dispatch mit Bestätigung).

### 4. Deploy-Pfad umstellen

Nach Grün: `/opt/gwada/live` existiert → `vps-deploy-live-app.sh` nutzt Compose+Caddy automatisch.

Smoke: `gh workflow run deploy-live-app.yml --ref main` → neuer SHA in build-info.

### 5. Coolify deaktivieren (erst danach)

1. Coolify-UI/Container stoppen (`coolify`, `coolify-db`, …) — **nicht** Supabase-Service-Compose löschen.
2. Port 8000 bleibt zu (bereits gehärtet).
3. **Vollständig entfernen (Prune):** Control-Plane-Container + Images + Volumes + `/data/coolify/{source,proxy,applications}` — **nicht** `/data/coolify/services/` (Live-Supabase + Authelia), **nicht** Netz `coolify`, **nicht** `/opt/gwada/live`, **nicht** Dev-DB.
   - Skript: `scripts/vps-prune-coolify-control-plane.sh` (`GWADA_CONFIRM_PRUNE_COOLIFY=PRUNE`)
   - Workflow: `prune-coolify-control-plane.yml` (Dispatch `confirm=PRUNE` oder Push-Trigger `.github/triggers/prune-coolify-control-plane.env`)
4. App-Env-Backup unter `/opt/gwada/live/.env` behalten.
5. Docs: `docs/coolify-live-deploy.md` → Verweis auf Compose+Caddy / dieses Runbook.

---

## Rollback

1. Caddy-Stack stoppen: `cd /opt/gwada/live && docker compose down`
2. Coolify-Proxy (Traefik) wieder starten (Coolify-Source-Compose / bisheriger Proxy-Container).
3. App-Compose unter `/data/coolify/applications/d3cg1b54arvue2tcm8u34qty` `docker compose up -d`.
4. build-info + Studio prüfen.
5. Im Zweifel: Contabo-Snapshot zurückrollen (längerer Outage).

Deploy-Skripte mit fehlendem `/opt/gwada/live` fallen wieder auf Coolify-Pfad zurück.

---

## Risiken

| Risiko | Mitigation |
|--------|------------|
| Traefik/Caddy Port-Konflikt | Strikte Reihenfolge: Traefik stop → Caddy up |
| Supabase-Netz nicht am App-Container | Compose `networks` + Verify `/sb` |
| Authelia nur über Traefik-Labels | Caddy `forward_auth` + Authelia im gemeinsamen Netz |
| Let’s Encrypt Rate-Limit | Gleicher Hostname; Caddy speichert unter Volume `caddy_data` |
| Secrets im Git | Nur `.env.example` im Repo; Live-`.env` nur auf VPS |
| Dev-DB / Staging | Unverändert `/opt/gwada-supabase-dev` |

---

## Verify-Checkliste (nach Cutover)

- [x] `https://gwada.app/api/build-info` = `451bc4a`
- [x] `/` und `/login` → HTTP 200 · Header `server: Caddy`
- [x] `/sb` → Kong erreichbar (401 ohne Key = Proxy OK, kein 502)
- [x] Studio → 302 Authelia · Auth → 200 (über Caddy)
- [ ] `deploy-live-app` einmal post-Cutover (noch ausstehend, optional)
- [x] Coolify-UI gestoppt; App weiter grün
- [x] Dev-DB-Pfad nicht angefasst (weiter eigenes Restart-Thema)

---

## Outcome 2026-10-26 (Live)

| Item | Ergebnis |
|------|----------|
| Contabo-Snapshot | David: „Ist durch“ |
| Prep-PR | [#594](https://github.com/daviddr17/gwada-app/pull/594) → `main` (`a0bf591a`) |
| Cutover-PR | [#595](https://github.com/daviddr17/gwada-app/pull/595) → `main` |
| Cutover-Run | [40326278584](https://github.com/daviddr17/gwada-app/actions/runs/40326278584) **success** (~45s; kurz DOWN, dann wieder `451bc4a`) |
| Coolify-Stop-Run | [40326454251](https://github.com/daviddr17/gwada-app/actions/runs/40326454251) **success** |
| Edge | `coolify-proxy` (Traefik) **Exited** · `gwada-caddy` **Up** · `server: Caddy` |
| App | `gwada-app` = `ghcr.io/daviddr17/gwada-app:451bc4a` unter `/opt/gwada/live` |
| Coolify UI | `coolify` / `coolify-db` / `coolify-redis` / `coolify-realtime` **gestoppt** (Container noch vorhanden, nicht gelöscht) |
| Supabase Live | unverändert (`*-oogd5syyxiqb1k4g0wy1u9n8`) |
| Trigger-Dateien | disarmed (`status=done`) — Re-Arm nur bewusst |
| Prune (vollständig) | Runs [40327953205](https://github.com/daviddr17/gwada-app/actions/runs/40327953205) + [40328236658](https://github.com/daviddr17/gwada-app/actions/runs/40328236658) **success** — Control-Plane weg; `/data/coolify` nur noch `services/`; Live `451bc4a` / Caddy OK |

**Hinweis Agent:** `gh workflow run` war 403 → Cutover/Stop über Push-Trigger `.github/triggers/*.env` (wie `deploy-live.env`).

Siehe auch: [hosting-vergleich-coolify.md](./hosting-vergleich-coolify.md), Repo `docs/coolify-live-deploy.md`, `docs/live-deploy.md`, `docs/gwada-app-domains.md`.
