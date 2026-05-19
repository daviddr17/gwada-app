# Coolify: Live-Postgres für Migrationen (5 Minuten)

Die App nutzt **Port 8001** (API). Migrationen brauchen **Postgres auf 5432**.

| Coolify (intern) | Für deinen Mac |
|------------------|----------------|
| `POSTGRES_HOST=supabase-db` | **nicht verwenden** |
| `POSTGRES_PORT=5432` | `5432` (oder Tunnel, siehe unten) |
| Passwort = `SERVICE_PASSWORD_POSTGRES` | in `SUPABASE_DB_URL` |

`PG_META_DB_PASSWORD=${SERVICE_PASSWORD_POSTGRES}` → **dasselbe Passwort**.

---

## Schritt 1 — Passwort in Coolify kopieren

1. **Coolify** öffnen → dein **Supabase**-Stack auf dem VPS.
2. **Environment Variables**.
3. Variable **`SERVICE_PASSWORD_POSTGRES`** suchen → **Wert anzeigen/kopieren** (langer String).
4. Nicht `PG_META_DB_PASSWORD` kopieren — das ist nur `${SERVICE_PASSWORD_POSTGRES}` als Referenz.

---

## Schritt 2 — URL automatisch in `.env.production` schreiben

Im Projektordner `gwada-app`:

```bash
npm run db:setup:live-url
```

Passwort einfügen → Enter.

(Direkt ohne Prompt: `node scripts/set-supabase-db-url.mjs 'DEIN_PASSWORT'` — Vorsicht mit Shell-History.)

Es entsteht z. B.:

```env
SUPABASE_DB_URL=postgresql://postgres:…@95.111.229.250:5432/postgres
```

---

## Schritt 3 — Verbindung testen

```bash
npm run db:push:live -- --dry-run
```

- **OK:** Liste der Migrationen, die auf Live angewendet würden.
- **`connection refused`:** Port 5432 ist von außen zu → **Schritt 4**.
- **`password authentication failed`:** Passwort nochmal aus Coolify kopieren.

---

## Schritt 4 — Nur bei „connection refused“ (SSH-Tunnel)

Terminal 1 (offen lassen):

```bash
npm run db:tunnel:live
```

Standard: `127.0.0.1:5432` **auf dem VPS** (nicht `supabase-db` — der Name gilt nur im Docker-Netz).

**Fehler** `Temporary failure in name resolution` → du hattest `supabase-db` als Ziel; Skript ist darauf angepasst.

**Fehler** `tls error` / `connection reset by peer` → in der URL `?sslmode=disable` (macht `db:setup:live-url` / `db-push-live.sh` automatisch). Tunnel muss in Terminal 1 laufen.

**Postgres-Port auf dem VPS finden** (einmalig, vom Mac):

```bash
ssh root@95.111.229.250 'docker ps --format "table {{.Names}}\t{{.Ports}}" | grep -iE "db|postgres"'
```

**Nur `5432/tcp` (ohne `0.0.0.0:…`)** — Postgres hängt nur im Docker-Netz (dein Fall mit `supabase-db-…`).

Dann reicht:

```bash
npm run db:tunnel:live
```

Das Skript holt per SSH die **Container-IP** und baut den Tunnel (nicht `supabase-db`, nicht `127.0.0.1:5432` auf dem Host).

**Optional in Coolify:** Postgres **Port 5432 auf den Host publishen** → danach geht auch `LIVE_TUNNEL_REMOTE_HOST=127.0.0.1 npm run db:tunnel:live`.

Siehst du `0.0.0.0:5434->5432/tcp`, Host-Port **5434**:

```bash
LIVE_TUNNEL_REMOTE_HOST=127.0.0.1 LIVE_TUNNEL_REMOTE_PORT=5434 npm run db:tunnel:live
```

Terminal 2:

```bash
LIVE_DB_HOST=127.0.0.1 LIVE_DB_PORT=5433 npm run db:setup:live-url
npm run db:push:live -- --dry-run
```

---

## Schritt 4b — Optional: Postgres in Coolify nach außen

Nur wenn du **keinen** Tunnel willst: Postgres-Service → Port **5432** auf die VPS-IP mappen (Sicherheit beachten: Firewall / nur deine IP).

---

## Danach (bei „jetzt live“)

1. `npm run db:push:live` — Schema auf Live (keine Testdaten).
2. Git deploy (Coolify) — App.

Studio: http://95.111.229.250:54323
