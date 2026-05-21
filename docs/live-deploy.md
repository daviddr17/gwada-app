# Live deployen (ein Befehl für dich, zwei für den Agenten)

## Einmalig: SSH ohne Passwort

Sonst fragt SSH bei jedem Deploy nach dem Root-Passwort:

```bash
ssh-copy-id root@95.111.229.250
```

(Test: `ssh root@95.111.229.250 true` — keine Passwortabfrage.)

## Was du sagst

> **„Live deployen bitte“** (oder „jetzt live“)

Der Agent führt aus:

1. `npm run deploy:live` — Tunnel + DB-Migrationen (**nur Schema**, Standard)
2. Git commit + push nach `main` → Coolify baut die App

**Mit lokalen Einträgen** (nur auf ausdrückliche Anfrage, überschreibt Live-`public`-Daten):

```bash
npm run deploy:live:full
```

**Nur App-Daten (`public`)** — Gerichte, Reservierungen, Bestand (Login bleibt):

```bash
npm run sync:live:public
```

(Wenn lokal nach dem ersten Sync erst Seeds/Demos kamen, einmal nachziehen.)

Mit lokalen **Login-Usern** (`auth`):

```bash
npm run sync:live:data:all
```

## Selbst testen

```bash
npm run deploy:live:dry-run   # nur anzeigen
npm run deploy:live           # Migrationen anwenden
```

## Wenn SSH scheitert

- `ssh-copy-id` nachholen, oder
- Terminal 1: `npm run db:tunnel:live` · Terminal 2: `npm run db:push:live`

## Container-IP

In `.env.production`: `LIVE_TUNNEL_REMOTE_HOST=10.0.2.6` — nach Supabase-Container-Neustart ggf. neu ermitteln (`npm run db:tunnel:live` zeigt die IP).
