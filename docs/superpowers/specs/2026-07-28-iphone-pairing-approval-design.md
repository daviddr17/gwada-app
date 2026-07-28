# iPhone Pairing & Approval (Schritt 3) — Design

Stand: abgestimmt 2026-07-28. Umsetzung von Schritt 3 aus
[`docs/plans/kellner-onboarding-enrollment.md`](../../plans/kellner-onboarding-enrollment.md).

## Ziel & Scope

Ein iPhone (Handheld) koppelt sich per LAN an den iPad-Hub, wird **einzeln am iPad
freigegeben** (Code-Abgleich) und erreicht danach die Betriebs-UI (Tische/Reservierungen).
Freigegebene Geräte erhalten einen Pairing-Token, den der Hub auf den Daten-Endpunkten
**erzwingt**.

**Validierung**: sim-testbar auf einem Mac — iPhone-Sim → iPad-Sim über `127.0.0.1:8787`
(Simulatoren teilen den Host-Loopback; Bonjour funktioniert zwischen zwei Sims nicht).

### In Scope
- LAN-Pairing-Protokoll (request / status) + Pairing-Token-Header
- Hub: Pairing-State-Machine, Freigabe-UI, Token-Enforcement auf Daten-Endpunkten
- iPhone: Kopplungs-Flow (Bonjour + manuelles Host-Feld), Warten-auf-Freigabe, Token-Persistenz
- Unit-Tests der State-Machine + manueller Sim-Integrationspfad

### Nicht in Scope (spätere Schritte)
- Kellner-PIN → Quittungsname (Schritt 4)
- QR-Kamera-Scan am iPhone (Sim kann's nicht; iPad zeigt QR nur zur Anzeige)
- Live-Production-Kanal
- Kunden-Solo / manuelle Cloud-URL-UI

## Ausgangslage (Ist)

- LAN-Endpunkte (`/v1/health`, `/v1/snapshot`, `/v1/sessions`, `/v1/orders`,
  `/v1/reservations`, `/v1/kds*`, `/v1/print-jobs`) sind **komplett ungesichert** — kein Token.
- iPhone wählt den Hub **nur per Bonjour** (`BonjourHubBrowser`), verbindet zum ersten Fund,
  **keine Freigabe**.
- `HubHTTPServer`-Handler-Signatur ist `(method, pathWithQuery, body) -> response` — **ohne
  Header** (muss für Token-Check erweitert werden).
- Hub-Routing sitzt in `PosRuntime.startHub()` (`HubHTTPServer { method, path, body in … }`).
- `PosEnrollmentStore` modelliert `isHandheldPaired` (Bool, kein Token/keine Hub-Adresse).
- Rollen-Detektion: iPad → `.hub`, iPhone → `.handheld` (`PosDeviceRoleDetector`, idiom-basiert).
- `pos_lan_shared_secret`-Migration existiert, wird im Swift-LAN-Layer aber nicht genutzt.

## Architektur

Ansatz **A (LAN-only)**: Hub hält Pending in-memory, iPhone pollt Status. Kein Cloud-Roundtrip;
passt zum LAN-Modell „Daten primär vom Hub" und ist auf einem Mac E2E-testbar.

Verworfen: **B** cloud-vermittelte Freigabe (mehr Infra, widerspricht LAN-Modell),
**C** Auto-Pair ohne explizite Freigabe (Plan verlangt Freigabe pro Gerät).

### Komponenten

**1. Protokoll — `PosLanProtocol` / `PosLanModels`**
- Neue Pfade: `pairRequestPath = "/v1/pair/request"`, `pairStatusPath = "/v1/pair/status"`
- Neuer Header: `headerPairToken = "X-Gwada-Pair-Token"`
- DTOs (`Codable, Sendable`):
  - `PosLanPairRequest { deviceName: String, installationId: String }`
  - `PosLanPairChallenge { pairId: String, verificationCode: String }` (6-stellig, numerisch)
  - `PosLanPairStatus { state: String /* pending|approved|rejected|expired */, token: String?, hub: PosLanHubInfo? }`

**2. Hub (iPad)**
- **`PosPairingStore`** (neu, `@MainActor ObservableObject`):
  - `@Published pending: [PendingPairing]` (pairId, deviceName, installationId, verificationCode, createdAt)
  - `@Published approved: [ApprovedDevice]` (deviceId/installationId, deviceName, token, approvedAt)
  - `func createPending(request) -> PosLanPairChallenge` — erzeugt 6-stelligen Code + pairId
  - `func approve(pairId) -> token` / `func reject(pairId)` — MainActor-Aktionen aus der UI
  - `func status(pairId) -> PosLanPairStatus`
  - `func verify(token) -> Bool` — für Endpoint-Enforcement (thread-safe Snapshot der Tokens)
  - `func revoke(token/deviceId)` — Geräte-Widerruf
  - Expiry: Pending älter als 5 min → `expired`
  - Persistenz: genehmigte Tokens in UserDefaults (Token = opak, z. B. 256-bit base64url);
    Pending bleibt in-memory (überlebt keinen Hub-Neustart — akzeptabel).
- **`HubHTTPServer`**: `ParsedRequest` um `headers: [String:String]` erweitern, Handler-Typ auf
  `(method, pathWithQuery, headers, body) -> response`. Header-Parsing case-insensitiv.
- **`PosRuntime.startHub` Routing** (Ergänzungen):
  - `POST /v1/pair/request` → `PosPairingStore.createPending` → `201 {pairId, verificationCode}`
  - `GET /v1/pair/status?pairId=…` → `200 PosLanPairStatus`
  - **Enforcement**: `snapshot`, `sessions`, `orders`, `reservations`, `kds`-JSON verlangen
    gültigen `X-Gwada-Pair-Token` (via `PosPairingStore.verify`) → sonst **401**.
    `health` (Discovery) + KDS-Browser-HTML (`KdsHubHTML`) bleiben **offen**.
    Anmerkung: Hub-eigene lokale Aufrufe brauchen keinen LAN-Token (laufen nicht über HTTP).
- **iPad-UI „Handgeräte verbinden"** (neue View, z. B. `HubPairingApprovalsView`):
  - Pending-Liste: Gerätename + 6-stelliger Code, Buttons `Freigeben` / `Ablehnen`
  - Genehmigte Geräte: Liste + `Widerrufen`
  - Hub-Adresse als Text + QR (nur Anzeige; QR encodiert `host:port`, keinen Token)
  - Einstieg über das vorhandene Personen-Plus-Icon in der Hub-Toolbar (`RootView` hubSplitView)

**3. iPhone (Handheld)**
- **`HandheldPairingGateView`** erweitern (oder `HandheldPairingRequestView` abspalten):
  - Bonjour-Scan zuerst; wenn kein Hub gefunden → Feld „Hub-Adresse" (Host:Port),
    DEBUG-Default `127.0.0.1:8787` vorausgefüllt
  - „Koppeln" → `HandheldHubClient.requestPairing` → Screen „Warten auf Freigabe am iPad" +
    Anzeige des 6-stelligen Codes zum Abgleich
  - Poll `pairingStatus` (z. B. alle 2 s) → bei `approved`: Token + Hub-BaseURL in
    `PosEnrollmentStore`, `markHandheldPaired()` → RootView wechselt in Tische-UI
  - bei `rejected`/`expired`: Meldung + „erneut versuchen"
- **`HandheldHubClient`**: `X-Gwada-Pair-Token`-Header an alle Daten-Requests;
  neue Calls `requestPairing(baseURL, request)` und `pairingStatus(baseURL, pairId)`
- **`PosEnrollmentStore`**: `handheldPairToken: String?` + `handheldHubBaseURL: String?`
  zusätzlich zu `isHandheldPaired`; `markHandheldPaired(token:hubBaseURL:)`,
  `resetHandheldPairing()` löscht beides

**4. RootView** (bestehende Gate-Logik): Handheld-Gate bei
`!isHandheldPaired && hubBaseURL == nil && !isSoloMode`. Nach Pairing verbindet Runtime mit
gespeicherter Hub-Adresse + Token; bei 401 (Token ungültig/widerrufen) zurück zum Gate.

## Datenfluss (Happy Path)

```
iPhone                          iPad-Hub
  │ POST /v1/pair/request {deviceName, installationId}
  │─────────────────────────────▶  PosPairingStore.createPending → Code C, pairId P
  │◀───────────────────────────── 201 {pairId P, verificationCode C}
  │ zeigt „Warten … Code C"        UI zeigt Pending: „iPhone X · C"
  │ GET /v1/pair/status?pairId=P (poll)
  │─────────────────────────────▶  state=pending
  │                                 Nutzer vergleicht C, tippt „Freigeben"
  │                                 PosPairingStore.approve(P) → Token T
  │ GET /v1/pair/status?pairId=P
  │─────────────────────────────▶  state=approved, token=T, hub=…
  │ speichert T + Hub-Adresse, markHandheldPaired
  │ GET /v1/snapshot  (Header X-Gwada-Pair-Token: T)
  │─────────────────────────────▶  verify(T) ok → 200 Snapshot
  │ → Tische-UI
```

## Fehlerbehandlung

| Fall | Verhalten |
|---|---|
| Daten-Request ohne/ungültiger Token | Hub **401** → iPhone zurück zum Pairing-Gate |
| Freigabe abgelehnt | `status=rejected` → iPhone „abgelehnt", Retry möglich |
| Pending > 5 min | `status=expired` → Code ungültig, neu anfragen |
| Manueller Host unerreichbar | Verbindungsfehler → Meldung + Retry |
| Token am iPad widerrufen | nächster Request 401 → iPhone zurück zum Gate |
| Hub-Neustart (Pending weg) | iPhone-Poll bekommt `expired`/404 → neu anfragen |

## Tests

- **Unit (`PosPairingStore`)**: `createPending` erzeugt eindeutige pairId + 6-stelligen Code;
  `approve` liefert Token und verschiebt Pending→approved; `verify(token)` true nur für
  genehmigte, false sonst; `reject`; Expiry nach 5 min; `revoke` invalidiert Token.
  Reines Swift, host-/sim-testbar.
- **Integration (manuell, Sim)**: iPad-Sim (Hub) + iPhone-Sim → `127.0.0.1:8787` → Anfrage →
  Freigabe am iPad (Code-Abgleich) → iPhone erreicht Tische. Zusätzlich: ungekoppeltes iPhone
  bekommt 401; Widerruf am iPad wirft iPhone zurück.

## Akzeptanzkriterien (aus Plan)

- [ ] iPhone: Anfrage → wartet → iPad genehmigt (Code-Abgleich) → Tische-UI
- [ ] Zweites iPhone = eigene Freigabe
- [ ] Ungekoppeltes/abgelehntes Gerät: kein Datenzugriff (401)
- [ ] Token-Widerruf am iPad wirkt sofort
