# Gwada-Domains (Production)

**DNS:** IONOS / Cloudflare · **App-Server:** Contabo VPS `95.111.229.250`

| Host | Dienst |
|------|--------|
| **`gwada.app`** | Next.js-App (Coolify, HTTPS) — **Production** |
| **`old.gwada.app`** | Legacy Bubble-App |
| **`new.gwada.app`** | Optional 301 → `gwada.app` (früheres Staging) |
| **`studio.new.gwada.app`** | Supabase Studio (Authelia 2FA) |
| **`auth.new.gwada.app`** | Authelia Login |

```text
gwada.app          → Next.js (Coolify)
old.gwada.app      → Bubble
new.gwada.app      → optional Redirect → gwada.app
95.111.229.250     → VPS (Supabase intern, /sb-Proxy)
```

| Komponente | Production |
|------------|------------|
| Frontend | `https://gwada.app` |
| Supabase (Browser) | `https://gwada.app/sb` |
| Supabase Kong (intern) | Docker-Netz / `SUPABASE_UPSTREAM_URL` |

---

## DNS bei IONOS (Cutover)

| Record | Typ | Wert |
|--------|-----|------|
| `@` (gwada.app) | A | `95.111.229.250` |
| `old` | A/CNAME | Bubble-Host (Bubble Custom Domain) |
| `new` | A | `95.111.229.250` (nur wenn Redirect gewünscht) |
| `studio.new` | A | `95.111.229.250` |
| `auth.new` | A | `95.111.229.250` |

**Reihenfolge:** Zuerst `old.gwada.app` in Bubble einrichten und testen, dann Apex `gwada.app` auf den VPS umstellen.

---

## Coolify Env (Build + Runtime)

```env
NEXT_PUBLIC_SITE_URL=https://gwada.app
NEXT_PUBLIC_SUPABASE_URL=https://gwada.app/sb
NEXT_PUBLIC_SUPABASE_PROXY=true
NEXT_PUBLIC_SUPABASE_ANON_KEY=<Live-Anon-Key>
SUPABASE_UPSTREAM_URL=http://supabase-kong-…:8000

GWADA_LEGACY_BUBBLE_URL=https://old.gwada.app
GWADA_SUPABASE_STUDIO_URL=https://studio.new.gwada.app
CHANGELOG_SYNC_URL=https://gwada.app/api/superadmin/changelog/sync-from-git
```

Vorlage: `.env.production.example`

---

## VPS-Cutover (automatisiert)

Voraussetzung: DNS `gwada.app` → VPS, `ssh-copy-id root@95.111.229.250`

```bash
bash scripts/vps-cutover-production-domain.sh
```

Optional Redirect `new` → `gwada`:

```bash
bash scripts/vps-traefik-redirect-new-to-gwada.sh
```

Danach App neu bauen (NEXT_PUBLIC_*):

```bash
gh workflow run deploy-live-app.yml --ref main
curl -s https://gwada.app/api/build-info
```

---

## GoTrue / OAuth

Redirect-URLs (Script patcht beide):

- `https://gwada.app/auth/callback` (Primary)
- `https://new.gwada.app/auth/callback` (Legacy)

```bash
APP_ORIGIN=https://gwada.app bash scripts/vps-patch-gotrue-redirects.sh
```

Google Cloud Console: Callbacks auf `https://gwada.app/api/integrations/.../callback` ergänzen.

---

## Smoke-Test

- [ ] `https://gwada.app/api/build-info` — aktueller Commit-SHA
- [ ] Login / OAuth
- [ ] `/sb` — Supabase-Proxy
- [ ] Embed-Snippets (ggf. `new` → 301 oder Snippets aktualisieren)
- [ ] `https://old.gwada.app` — Bubble erreichbar
- [ ] Staff-App EAS: `EXPO_PUBLIC_GWADA_API_URL=https://gwada.app`

---

Siehe auch: [coolify-live-deploy.md](./coolify-live-deploy.md), [supabase-lokal-und-live.md](./supabase-lokal-und-live.md)

**Historisch:** Früheres Staging-Modell dokumentiert in Git-History von `docs/new-gwada-app-staging.md`.
