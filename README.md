# gwada-app

Restaurant-Betriebssystem (Next.js Monorepo): Speisekarte, Reservierungen, Nachrichten, Team, Bestand, POS/Kiosk, öffentliche Profile und Public API / MCP.

## Setup

```bash
bash scripts/ensure-pnpm.sh
pnpm install
pnpm dev
```

App: [http://localhost:3000](http://localhost:3000) — Code unter `apps/web/`. Standard-DB: Entwickler-Supabase auf dem VPS (`.env.development`), siehe `docs/remote-dev-supabase.md`.

## Dokumentation

| Was | Wo |
|-----|-----|
| Produkt-Handbuch + API | [gwada.app/docs](https://gwada.app/docs) (`apps/web/lib/docs`, `apps/web/app/(platform)/docs`) |
| Restaurant MCP | `/docs/api/mcp` — `POST /api/v1/mcp` |
| Live-Deploy / Infra | `docs/live-deploy.md`, `docs/coolify-live-deploy.md` |
| Dev-DB | `docs/remote-dev-supabase.md` |

## Workspace

```
apps/web          Next.js App + Handbuch/API-Docs
apps/dashboard    Vite-Dashboard-Routen (generiert)
packages/*        geteilte Pakete
supabase/         Migrationen
docs/             Ops-/Runbooks (nicht das Produkt-Handbuch)
```

Package Manager: **pnpm** (siehe `packageManager` in `package.json`).
