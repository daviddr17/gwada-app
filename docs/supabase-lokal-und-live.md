# Supabase: lokal entwickeln, Live nur Schema

Deine Live-Instanz läuft **selbst auf dem VPS** (`http://95.111.229.250:8001`) — das ist **kein** Supabase-Cloud-Projekt.  
`supabase link` (mit `supabase login`) ist nur für **supabase.com**-Projekte. Für den VPS nutzt du **`supabase db push --db-url`**.

---

## Übersicht

| | Lokal | Live (VPS) |
|---|--------|------------|
| **API** (App, Auth, REST) | `http://127.0.0.1:54321` | `http://95.111.229.250:8001` |
| **Studio** (Tabellen-UI, SQL) | `http://127.0.0.1:54323` | **http://95.111.229.250:54323** |
| **Postgres** (nur Migrationen) | `127.0.0.1:54322` | Host/Port + Passwort aus Coolify (oft `5432`) |
| **Schema ändern** | Migration in `supabase/migrations/` + `npm run db:push:local` | Bei Deploy: `npm run db:push:live` |
| **Testdaten** | `seed.sql`, Demo-Skripte, `--local` | **nicht** automatisch |

---

## 1. Lokal einrichten (einmalig)

### Docker

1. **Docker Desktop** starten.
2. Im Projektroot:

```bash
npm run db:start
```

3. Prüfen:

```bash
npm run db:status
```

### Env für die App

`.env.local` enthält bereits `NEXT_PUBLIC_SUPABASE_URL` und Keys (nach `supabase start` = Demo-Keys).

### Postgres-URL für Migrationen (lokal)

In **`.env.local`** ergänzen (steht auch in `.env.example`):

```env
SUPABASE_DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

(Standard-Passwort der lokalen CLI-DB ist `postgres`.)

### Erste Migrationen lokal anwenden

```bash
npm run db:push:local
```

Optional nur anzeigen, was käme:

```bash
npx supabase db push --local --dry-run
```

---

## 2. Live (VPS) — Postgres-URL finden

Die App spricht Port **8001** (Kong/API). **Studio** (Tabellen, SQL Editor) läuft bei dir auf **http://95.111.229.250:54323** — dort **nicht** `NEXT_PUBLIC_SUPABASE_URL` eintragen, nur im Browser öffnen.

**Migrationen** brauchen eine direkte **PostgreSQL**-Verbindung (meist Port **5432**, nicht 54323).

### In Coolify (dein Stack)

Typische Werte **im Container** (nur intern, nicht vom Mac aus erreichbar):

| Variable | Wert | Bedeutung |
|----------|------|-----------|
| `POSTGRES_HOST` | `supabase-db` | Hostname **nur** im Docker-Netzwerk |
| `POSTGRES_PORT` | `5432` | Postgres-Port |
| `POSTGRES_DB` | `postgres` | Datenbankname |

Für `SUPABASE_DB_URL` auf dem **Mac** stattdessen:

```env
SUPABASE_DB_URL=postgresql://postgres:POSTGRES_PASSWORD@95.111.229.250:5432/postgres
```

- **Host:** VPS-IP (`95.111.229.250`), **nicht** `supabase-db`
- **User:** meist `postgres` (in Coolify als `POSTGRES_USER` prüfen)
- **Passwort:** **`SERVICE_PASSWORD_POSTGRES`** in Coolify (`PG_META_DB_PASSWORD` zeigt nur darauf).  
  Schnellsetup: **`docs/coolify-postgres-einrichten.md`** → `npm run db:setup:live-url`

`PGRST_DB_SCHEMAS` brauchst du nur für PostgREST — nicht für `db push`.

### Wenn Port 5432 von außen nicht offen ist

3. Falls Postgres **nicht** von außen erreichbar ist:
   - Port **5432** nur für deine IP freigeben, **oder**
   - per **SSH-Tunnel**:  
     `ssh -N -L 5433:127.0.0.1:5432 user@95.111.229.250`  
     (nicht `supabase-db` — nur innerhalb von Docker erreichbar)  
     dann:  
     `SUPABASE_DB_URL=postgresql://postgres:PASSWORT@127.0.0.1:5433/postgres`

### In `.env.production` (nur auf deinem Rechner, gitignored)

Zusätzlich zu den `NEXT_PUBLIC_*`-Keys — **Zeile auskommentieren entfernen** (`#` vor `SUPABASE_DB_URL` löschen):

```env
SUPABASE_DB_URL=postgresql://postgres:DEIN_LIVE_PASSWORT@95.111.229.250:5432/postgres
```

(Port/Host anpassen, wenn Coolify andere Werte zeigt. Sonderzeichen im Passwort URL-encoden, z. B. `@` → `%40`.)

**Passwort finden:** Coolify → Supabase/Postgres-Service → Env `POSTGRES_PASSWORD` oder `DATABASE_URL`. Oder in Studio (http://95.111.229.250:54323) unter Project Settings / Database, falls angezeigt.

**Nicht** committen. Gleiche Variable kannst du in Coolify nur brauchen, wenn du Migrationen **auf dem Server** ausführst — für die Next-App reichen die drei Supabase-Keys.

### HTTPS-App + HTTP-Supabase (Bestand/Bestellungen scheitern im Browser)

Wenn die Gwada-App über **HTTPS** läuft, `NEXT_PUBLIC_SUPABASE_URL` aber **`http://…:8001`** ist, blockiert der Browser viele Client-Requests (Mixed Content). Login über Server-Middleware kann trotzdem funktionieren — **Speichern aus Client Components** (z. B. Bestellungen) dann nicht.

**Lösung:** Same-Origin-Proxy (`/sb` → Kong), in Coolify für die **Next-App**:

```env
NEXT_PUBLIC_SUPABASE_PROXY=true
SUPABASE_UPSTREAM_URL=http://95.111.229.250:8001
NEXT_PUBLIC_SITE_URL=https://DEINE_APP_DOMAIN
NEXT_PUBLIC_SUPABASE_URL=https://DEINE_APP_DOMAIN/sb
```

`SUPABASE_UPSTREAM_URL` nur Build/Runtime auf dem Server (Rewrite). Nach Deploy: erneut einloggen. In Supabase/GoTrue die Redirect-URL `https://DEINE_APP_DOMAIN/auth/callback` erlauben.

---

## 3. Schema auf Live bringen (nur Struktur)

Wenn neue Dateien unter `supabase/migrations/` liegen und lokal getestet sind:

```bash
# Optional: zeigen, was applied würde
npm run db:push:live -- --dry-run

# Anwenden (bestehende Daten bleiben, kein reset)
npm run db:push:live
```

Das entspricht:

```bash
dotenv -e .env.production -- supabase db push --db-url "$SUPABASE_DB_URL"
```

**Nicht** verwenden auf Live:

- `supabase db reset`
- `db push --include-seed`
- lokale `seed.sql` / Demo-SQL gegen Live (nur auf ausdrückliche Anfrage)

---

## 4. Zusammen mit Git / Coolify

Typischer Ablauf, wenn du „jetzt live“ sagst:

1. **Git:** commit + push → Coolify baut die App (Env-Vars in Coolify).
2. **DB:** `npm run db:push:live` von deinem Mac (mit gefüllter `SUPABASE_DB_URL` in `.env.production`).

Coolify deployed **keine** Migrationen automatisch, solange du keinen extra Build-Step einbaust. Schema und App-Deploy sind zwei Schritte.

---

## 5. Prüfen, ob lokal und live gleich sind

```bash
npx supabase migration list --local
dotenv -e .env.production -- supabase migration list --db-url "$SUPABASE_DB_URL"
```

Die Liste der angewendeten Migrationen sollte auf Live irgendwann dieselbe sein wie lokal (Live kann zurückliegen, bis du `db:push:live` machst).

---

## 6. Alternative ohne CLI: SQL im Studio

1. Migration-Datei aus `supabase/migrations/` öffnen.
2. **Supabase Studio:** http://95.111.229.250:54323 → SQL Editor.
3. Inhalt **einmalig** ausführen.

Nur sinnvoll für einzelne Hotfixes; dauerhaft besser: `db push` + Dateien im Git.

---

## 7. Häufige Fehler

| Problem | Lösung |
|--------|--------|
| `Cannot connect to Docker` | Docker Desktop starten, `npm run db:start` |
| `connection refused` auf Live | Falsche Host/Port; Postgres von außen gesperrt → SSH-Tunnel |
| `password authentication failed` | Passwort aus Coolify-Env kopieren |
| Migration schon angewendet | `migration list` prüfen; ggf. `supabase migration repair` (vorsichtig) |
| `supabase link` verlangt Login | Für VPS **nicht nötig** — `--db-url` nutzen |

---

## Kurz-Checkliste

- [ ] Docker + `npm run db:start` (lokal)
- [ ] `SUPABASE_DB_URL` in `.env.local`
- [ ] `SUPABASE_DB_URL` in `.env.production` (Live-Postgres)
- [ ] Supabase-Keys in **Coolify** (App)
- [ ] Bei Schema-Änderung: lokal `db:push:local`, bei Go-Live `db:push:live` + Git push
