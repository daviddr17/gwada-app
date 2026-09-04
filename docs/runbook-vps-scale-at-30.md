# VPS-Skalierung ab ~30 aktiven Restaurants

**Nicht jetzt ausführen.** Wenn wir bei ~30 dauerhaft aktiven Häusern sind: „jetzt durchführen“.

Heute: ein Contabo-VPS (`95.111.229.250`) — Next.js (Coolify) + Supabase/Postgres + Host-Crons. Das ist der Deckel, nicht die Feature-Liste.

## Zielbild (zwei Stufen)

### Stufe A — App und DB trennen (gleicher oder zweiter Host)

Postgres/Supabase bekommt eigene CPU/RAM (eigenes Compose-Projekt oder zweiter VPS). Die App bleibt stateless hinter Traefik.

- App-Deploy (`deploy-live-app.yml`) ändert sich kaum: Image pull + Container restart.
- DB-Deploy (`deploy-live-db.yml`) zeigt auf die **neue** `SUPABASE_DB_URL`.
- `/sb`-Proxy und `SUPABASE_UPSTREAM_URL` auf den DB-Host umbiegen.
- Kein `db reset`, keine Datenkopie außer bewusstem Cutover.

### Stufe B — zweites App-Replica

Zwei Coolify-App-Container, gleiches Image, gleiches Env, Traefik-Load-Balance auf `gwada.app`.

**Pflicht:** Crons laufen **nur auf einem** Knoten (bestehende Host-Crontab oder festes Replica-1). Sonst doppelte Outbox/Inbox.

Realtime und Cookies sind DB-basiert / Client-seitig — kein Session-Sticky nötig, solange beide Replicas dasselbe Image und dieselbe DB sehen.

Display-Sessions, Outbox-Claims und Inventory-RPCs bleiben in Postgres (Advisory Locks).

## Vor dem Cutover prüfen

```bash
bash scripts/vps-scale-at-30-preflight.sh
```

Der Preflight ändert nichts. Er prüft SSH, Coolify-App-Verzeichnis, Image, freien Speicher und dass `GWADA_CONFIRM_SCALE_AT_30` **nicht** gesetzt sein muss.

## Durchführung (nur nach ausdrücklicher Ansage)

1. Preflight grün.
2. `GWADA_CONFIRM_SCALE_AT_30=1 bash scripts/vps-scale-at-30-preflight.sh` — schreibt nur den Ist-Stand nach `docs/`-unabhängigem Log auf dem Agent-Rechner, **provisioniert nichts**.
3. Dann manuell, in dieser Reihenfolge:
   - Stufe A: Postgres-Ressourcen reservieren / Host trennen, App-Env auf neue DB-URL, `/sb` testen, erst dann DNS/Traefik umlegen.
   - Stufe B: zweite Coolify-App aus demselben Image, Health `/api/build-info`, Traefik-Service ergänzen, Crons fest auf Replica 1 belassen.
4. Verifizieren: `curl -s https://gwada.app/api/build-info`, Superadmin Ops, eine Test-Reservierung WhatsApp.

## Was wir bewusst nicht automatisch tun

- Keinen zweiten VPS kaufen oder bei Contabo anlegen
- Kein Live-DNS ändern
- Keine Produktionsdaten kopieren
- Keine zweite Crontab auf einem zweiten Host
