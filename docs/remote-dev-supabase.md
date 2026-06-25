# Remote-Dev: zweite Supabase auf dem VPS (Standard für `pnpm dev`)

**Einmalig einrichten (per GitHub Actions — kein lokales Docker):**

```bash
pnpm provision:dev          # startet Workflow auf dem VPS
gh run watch --workflow=provision-dev-supabase.yml --exit-status
pnpm setup:dev:env          # schreibt .env.development vom CI-Artifact
```

**Täglich (zwei Terminals):**

```bash
# Terminal 1 — Tunnel (Postgres :5434 + Kong API :8100)
pnpm db:tunnel:dev

# Terminal 2
pnpm dev                    # Hot Reload gegen Dev-DB
pnpm db:push                # Migrationen → Dev (Standard)
```

**Live nur explizit:**

```bash
GWADA_CONFIRM_LIVE_DB=1 pnpm db:push:live
```

---

## Warum?

| | Lokales Docker | `pnpm dev` (Dev-VPS) | `pnpm dev:live` |
|---|----------------|----------------------|-----------------|
| Mac-Speicher | ~12 GB+ | minimal | minimal |
| Daten | lokal | **Dev** (wegwerfbar) | **Live** |
| Migrationen | `db:push:local` | **`pnpm db:push`** | riskant |

Live und Dev sind **getrennte** Supabase-Stacks auf dem gleichen VPS (`/opt/gwada-supabase-dev`).

---

## Skripte

| Befehl | Zweck |
|--------|--------|
| `pnpm provision:dev` | Dev-Stack auf VPS anlegen (CI) |
| `pnpm setup:dev:env` | `.env.development` aus letztem CI-Run |
| `pnpm db:tunnel:dev` | SSH-Tunnel Postgres + Kong |
| `pnpm dev` | Next.js → Dev-DB |
| `pnpm db:push` | Migrationen → Dev |
| `pnpm dev:local` | Nur mit lokalem Docker |
| `pnpm dev:live` | Paritätscheck Live |
| `GWADA_CONFIRM_LIVE_DB=1 pnpm db:push:live` | Migrationen → Live |

---

## Env

Vorlage: `.env.development.example` · aktiv: `.env.development` (gitignored)

- `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:8100` (über Tunnel)
- `NEXT_PUBLIC_GWADA_WORKSPACE_SLUG=gwada-dev`

---

## SSH vom Mac

Falls `pnpm db:tunnel:dev` mit „Permission denied“ scheitert:

```bash
ssh-add --apple-use-keychain ~/.ssh/gwada_vps_ed25519
```

Oder Migrationen nur per CI: `gh workflow run deploy-dev-db.yml --ref main`

---

## Agent-Regel

Neue Migrationen: **immer** `pnpm db:push` (Dev). Live nur auf **explizite** Nutzer-Anfrage.
