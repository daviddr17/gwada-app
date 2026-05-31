# Staging: `new.gwada.app` → später `gwada.app`

**Infrastruktur:** VPS bei **Contabo** (`95.111.229.250`) · Domain/DNS bei **IONOS** (`gwada.app`).

Die **alte Bubble-App** bleibt auf **`gwada.app`**. Die **neue Gwada-App** kommt zuerst auf **`new.gwada.app`** (gleicher Contabo-VPS, Coolify). Der Umzug auf `gwada.app` ist später **nur DNS + zwei Env-Variablen + Redeploy** — kein Code-Umbau.

---

## Architektur

```text
gwada.app          → Bubble (unverändert, bis Cutover)
new.gwada.app      → Neue Next.js-App (Coolify, HTTPS)
95.111.229.250     → VPS (Supabase intern, keine öffentlichen DB-Ports)
```

| Komponente | Staging | Später Production |
|------------|---------|-------------------|
| Frontend | `https://new.gwada.app` | `https://gwada.app` |
| Supabase (Browser) | `https://new.gwada.app/sb` | `https://gwada.app/sb` |
| Supabase Kong (intern) | `http://127.0.0.1:8001` oder Docker-Host | gleich |
| Datenbank | Supabase VPS (eigenständig, **nicht** Bubble) | gleiche DB |

---

## Phase 1 — DNS bei IONOS (einmalig)

Im **IONOS**-DNS für `gwada.app` (nicht im Contabo-Panel):

| Record | Typ | Wert |
|--------|-----|------|
| `new` | A | `95.111.229.250` (Contabo-VPS) |

`gwada.app` selbst **unverändert** lassen (Bubble), bis zum Cutover.

Falls `gwada.app` über **Cloudflare** proxyt: für `new` ggf. gleiches Setup — **Origin** muss auf die Contabo-IP zeigen.

Prüfen: `host new.gwada.app` → IP oder Cloudflare (dann Origin in CF prüfen).

### Contabo: Root-Passwort / SSH vergessen

1. [Contabo Customer Control Panel](https://my.contabo.com/) → **VPS** → dein Server  
2. **Password reset** / Zugangsdaten neu setzen (Root)  
3. Danach: `ssh root@95.111.229.250` und `ssh-copy-id` (siehe unten)

---

## Phase 2 — Coolify: neue Application

**Neue** Coolify-App anlegen (die Bubble-/alte App **nicht** anfassen):

1. **Source:** GitHub `daviddr17/gwada-app`, Branch `main`
2. **Domain:** `new.gwada.app` (HTTPS / Let’s Encrypt in Coolify)
3. **Port:** 3000 (wie bisher)

### Build- **und** Runtime-Env

`NEXT_PUBLIC_*` müssen beim **Build** gesetzt sein (Coolify „Build Variables“ + Runtime):

```env
NEXT_PUBLIC_SITE_URL=https://new.gwada.app
NEXT_PUBLIC_SUPABASE_URL=https://new.gwada.app/sb
NEXT_PUBLIC_SUPABASE_PROXY=true
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Live-Anon-Key>
NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-demo
NEXT_PUBLIC_GWADA_SUPABASE_ONLY=false

# Nur Server (Runtime + Build für Rewrites)
SUPABASE_UPSTREAM_URL=http://127.0.0.1:8001
SUPABASE_SERVICE_ROLE_KEY=<Live-Service-Role>

# Optional Superadmin → Datenbank
GWADA_PLANNED_PRODUCTION_URL=https://gwada.app
GWADA_COOLIFY_DASHBOARD_URL=<dein Coolify-UI>

# Changelog Auto-Sync (GitHub Secrets + Coolify)
CHANGELOG_SYNC_URL=https://new.gwada.app/api/superadmin/changelog/sync-from-git
CHANGELOG_SYNC_SECRET=<langer Zufallsstring>
```

**Hinweis:** `SUPABASE_UPSTREAM_URL` auf dem VPS oft `http://127.0.0.1:8001` oder die interne Docker-IP von Kong — **nicht** die öffentliche `:8001`-URL, wenn die Firewall zu ist.

Vorlage im Repo: `.env.production.example`

### Bestehendes Skript (SSH auf VPS)

Nach DNS und SSL kannst du Env am laufenden Container patchen:

```bash
APP_ORIGIN=https://new.gwada.app \
SUPABASE_UPSTREAM=http://127.0.0.1:8001 \
bash scripts/coolify-env-live-proxy.sh
```

(Voraussetzung: `ssh-copy-id root@95.111.229.250`)

---

## Phase 3 — Supabase Auth (GoTrue)

Redirect-URLs erlauben (Supabase auf VPS / Studio / `config`):

- `https://new.gwada.app/auth/callback`
- **bereits vorbereiten:** `https://gwada.app/auth/callback` (für späteren Cutover)

Site URL / additional redirect URLs in GoTrue-Konfiguration anpassen.

---

## Phase 4 — OAuth & Webhooks (wenn genutzt)

In Google / Meta Developer Console **beide** Callbacks eintragen:

- `https://new.gwada.app/api/integrations/.../callback`
- später `https://gwada.app/api/integrations/.../callback`

WAHA / n8n: Webhook-URLs prüfen, wenn sie feste Hosts erwarten.

---

## Phase 5 — Sicherheit VPS

Öffentlich nur **443 → Next.js**. Schließen oder einschränken:

| Port | Dienst | Empfehlung |
|------|--------|------------|
| 54323 | Supabase Studio | nur SSH-Tunnel / deine IP |
| 5432 | Postgres | nicht öffentlich |
| 8001 | Kong | intern; Browser nutzt `/sb` |

Studio lokal: `ssh -L 54323:127.0.0.1:54323 root@95.111.229.250`

---

## Phase 6 — Deploy-Workflow (ohne „Live-Push-Button“)

1. Lokal entwickeln + `npm run db:push:local`
2. Commit mit optional `Changelog:` im Body → Push `main`
3. Coolify baut automatisch → `new.gwada.app`
4. Schema Live: `npm run deploy:live` (vom Mac, wenn SSH + `.env.production`)
5. GitHub Action sync Changelog (wenn Secrets gesetzt)

Kein Button in der Testumgebung nötig — **Git push = Deploy**.

---

## Phase 7 — Smoke-Test auf `new.gwada.app`

- [ ] Login / Magic Link
- [ ] Speisekarte + Bilder
- [ ] Reservierung + Embed-Snippet-URL
- [ ] Kontakte / WhatsApp (falls aktiv)
- [ ] Display-Kopplung
- [ ] Superadmin → Datenbank (Verbindung grün)

---

## Cutover `new.gwada.app` → `gwada.app` (wenn fertig)

1. Bubble auf `gwada.app` read-only oder abschalten
2. Coolify Env ändern:
   - `NEXT_PUBLIC_SITE_URL=https://gwada.app`
   - `NEXT_PUBLIC_SUPABASE_URL=https://gwada.app/sb`
3. **Redeploy** (Build wegen `NEXT_PUBLIC_*`)
4. DNS `gwada.app` → Coolify (A-Record wie `new`)
5. GoTrue/OAuth waren schon vorbereitet → testen
6. Optional: `new.gwada.app` → 301 auf `gwada.app`
7. Bubble-Export → Import in Gwada (separates Projekt, wenn alles steht)

**Kein zweites Repo, keine zweite Datenbank** — nur Domain + Env.

---

## Lokal gegen Live-DB testen (optional)

```bash
npm run dev:live
```

Nutzt `.env.production` — Vorsicht, echte Live-Daten.

---

## Checkliste „Heute starten“

- [ ] DNS `new.gwada.app` → VPS
- [ ] Coolify-App + SSL
- [ ] Env wie oben (Build + Runtime)
- [ ] GoTrue Redirect `new.gwada.app`
- [ ] Firewall Studio/Postgres
- [ ] Erster Deploy von `main`
- [ ] `npm run deploy:live` für Schema
