# Runbook: Meta Webhooks (Facebook Page + Instagram)

**Ziel:** In der Meta Developer Console nur noch **Callback Verify** und **Feld-Subscribe** klicken.  
Gwada-Code, Env-Doku und Inbound-Gate sind bereit. Live-Inbound bleibt **aus**, bis `pages_messaging` Advanced Access hat.

Verwandt: `docs/meta-app-review-kit.md` §1.3 · Store `docs/meta-app-review-resubmit.md` · Store `docs/facebook-instagram-message-db.md`

---

## Endpoint

| | |
|--|--|
| **Callback URL** | `https://gwada.app/api/integrations/meta/webhook` |
| **GET** | Meta Verify (`hub.mode`, `hub.verify_token`, `hub.challenge`) |
| **POST** | Events; Signatur `x-hub-signature-256`; DB-Schreiben nur mit Inbound-Flag |
| **Fallback Inbox** | Cron `meta-inbox-sync` (täglich 04:00 UTC) — bleibt Catch-up |

---

## Env (Live / VPS)

| Variable | Pflicht für Verify? | Pflicht für Signatur? | Pflicht für DB-Inbound? | Hinweis |
|----------|---------------------|------------------------|-------------------------|---------|
| `META_WEBHOOK_VERIFY_TOKEN` | **Ja** | — | — | Beliebiger langer String; **1:1** in Meta Console → Webhooks → Verify Token |
| `META_APP_SECRET` | — | Empfohlen | Empfohlen | Optional wenn Superadmin → Integrationen **Facebook** `client_secret` gesetzt (App Secret). Env hat Vorrang. |
| `META_WEBHOOK_INBOUND_ENABLED` | — | — | **Ja** (`true`) | **Jetzt und bis Advanced Access `pages_messaging`: leer/`false` lassen.** |

Repo-Vorlagen: `.env.example`, `.env.production.example`.  
Plattform-OAuth-Keys bleiben in `platform_integrations` (Superadmin); Verify-Token gehört in die **App-/Container-Env**, nicht in die Client-Bundle.

### Live-Check ohne Secret zu leaken

Falsches Token → 403 (Endpoint erreichbar):

```bash
curl -sS -o /dev/null -w "%{http_code}\n" \
  "https://gwada.app/api/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=wrong&hub.challenge=test"
# erwartet: 403
```

Richtiges Token (nur lokal / einmalig, Token nicht committen):

```bash
curl -sS \
  "https://gwada.app/api/integrations/meta/webhook?hub.mode=subscribe&hub.verify_token=$META_WEBHOOK_VERIFY_TOKEN&hub.challenge=hello"
# erwartet: plain text `hello` und HTTP 200
```

POST ohne Inbound (nach Deploy mit App Secret: Signatur nötig; ohne Secret aktuell ACK):

```bash
# Ohne gültige Signatur und mit konfiguriertem App Secret → 401
# Mit Flag aus und gültiger Signatur (oder ohne Secret) → {"ok":true,"processed":0,"reason":"inbound_disabled"}
```

---

## David — Meta Console (jetzt)

1. App → **Webhooks** → Callback URL = oben, Verify Token = Live-`META_WEBHOOK_VERIFY_TOKEN`.
2. **Verify and Save** — muss grün sein (GET Challenge).
3. Objekt **Page** (ggf. **Instagram**): Felder abonnieren, die Messaging braucht:
   - Pflicht für Inbox: `messages`
   - Optional (Gwada speichert sie heute nicht, ACK ok): `messaging_postbacks`, `message_deliveries`, `message_reads`
4. **Nicht** Live-Env `META_WEBHOOK_INBOUND_ENABLED=true` setzen.
5. Page/IG an die App hängen (Subscribe) — ideal mit `pages_manage_metadata`; Test-Pages mit App-Rollen früher möglich.

Agent-VMs können Meta Login oft nicht (CAPTCHA) — Console-Schritte lokal.

---

## Nach Advanced Access `pages_messaging`

1. Parallel IG: `instagram_manage_messages` prüfen.
2. Live-Env: `META_WEBHOOK_INBOUND_ENABLED=true` → App neu deployen / Container restart.
3. Test-DM an verbundene Page → Kontakte → Nachrichten.
4. Cron `meta-inbox-sync` darf Catch-up bleiben.
5. Optional: Restaurant neu verbinden, falls Token ohne Messaging-Scope.

---

## Non-Messaging (`feed`, comments, page fields)

| | |
|--|--|
| Console abonnieren | Möglich, unabhängig von `pages_messaging` |
| Gwada-Nutzen jetzt | **Keiner** — Handler persistieren nur `entry[].messaging` |
| Module | News / Reviews / Insights / Profil weiter **Graph Pull + Cron** |
| POST-Antwort bei nur `changes` (Flag an) | `reason: non_messaging_ignored` |
| Entscheidung | Keine Handler in diesem Prep — Pull bleibt Quelle der Wahrheit |

Details: Store `internal/meta-webhooks-non-messaging-ohne-pages-messaging.md`.

---

## Checkliste „nur Console bleibt“

- [x] GET Verify Endpoint
- [x] POST Signatur (Env oder Superadmin App Secret)
- [x] Inbound-Gate default aus (`inbound_disabled`)
- [x] Env + Runbook dokumentiert
- [x] Non-Messaging dokumentiert (kein Handler)
- [ ] Live: `META_WEBHOOK_VERIFY_TOKEN` gesetzt und Console Verify grün *(David)*
- [ ] Console: Felder `messages` (+ optional) subscribed *(David)*
- [ ] Später: Flag `true` erst nach `pages_messaging` Advanced Access *(David)*
