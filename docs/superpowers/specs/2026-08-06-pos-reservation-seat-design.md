# POS Reservierung platzieren (Seat) — Design

**Datum:** 2026-08-06  
**Status:** Approved  
**Ansatz:** Hub-LAN SoT + Sync-Queue → Cloud (Ansatz 2)  
**Branch-Kontext:** `apps/pos` · Roadmap: Storno → **Seat** → Merge → Handover → Move LAN  
**Bezug:** Walk-in (`WalkInSheet` / `openTable`), Reservierungs-Timeline (`ReservationsView`), Cloud `POST /api/pos/table-sessions` (`reservationId`), Display Check-in (`seated`)

## Problem

Kellner sehen Reservierungen in der POS-Timeline und Hinweise am Tischplan, können Gäste aber nicht **als Reservierung** an einen Tisch setzen. Walk-in öffnet nur eine Session ohne Reservierungs-FK/Status. Web-Display kann Tisch zuweisen / Check-in (`seated`), öffnet aber keine POS-Session. Cloud akzeptiert bereits `reservationId` beim Session-Open — die Brücke UI → Hub → Sync fehlt.

## Ziele

1. **Platzieren** einer `confirmed`-Reservierung auf einen freien Tisch.
2. Einstieg von **Reservierungs-Timeline** und **Tischplan** (gleiche Logik).
3. Tisch: **zugewiesen → direkt**; sonst Picker. Belegt → Abbruch mit Hinweis.
4. Öffnet **POS-Table-Session** mit `reservationId`, Covers = `partySize`.
5. Reservierung lokal und in Cloud → Status **`seated`** (+ Tisch falls nötig).
6. Nach Erfolg **Navigation** in die Tisch-Session (Bestellung).
7. Hub bleibt **Source of Truth**; Handheld über LAN; Sync-Queue → Cloud.

## Nicht-Ziele (dieser Slice)

| Thema | Umgang |
|-------|--------|
| `pending` / angefragte Resas platzieren | Nein — nur `confirmed` |
| Bereits `seated` → „Zum Tisch“ springen | Später optional |
| Tisch mergen / Move / Handover | Nächste Roadmap-Items |
| Display-Web Check-in ersetzen | Bleibt parallel nutzbar |
| Kapazität hart blockieren | v1: Warnung optional; Hard-Block nur bei **belegt** |
| Cloud-only Seat ohne Hub | Nein — widerspricht Offline-Modell |

## Entscheidungen (bestätigt)

| # | Thema | Wahl |
|---|--------|------|
| 1 | UI-Einstieg | **C** — Timeline + Tischplan |
| 2 | Tischwahl | **A** — zugewiesen → direkt; sonst Picker |
| 3 | Tisch belegt | **A** — Abbruch + Hinweis |
| 4 | Erlaubte Status | **A** — nur `confirmed` |
| 5 | Datenpfad | **Ansatz 2** — Hub-LAN SoT + Sync-Queue |

## Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Platzieren / Seat** | `confirmed`-Reservierung → offene POS-Session + Status `seated` |
| **Zugewiesener Tisch** | `reservations.dining_table_id` / DTO `diningTableId` gesetzt |
| **Belegt** | Floor hat bereits eine offene Session auf dem Ziel-Tisch |
| **Covers** | `coverCount` der neuen Session = Reservierungs-`partySize` (Fallback 1) |

## Caps / Auth

- LAN-Mutation analog Collect/Void: in Production **Staff-Proof** (`X-Gwada-Staff-Id` / Session-Header); DEBUG-Lab darf `allowsHubCollectWithoutStaffSession` nutzen.
- Kein separates Cap-Slug für Seat in v1 (jeder eingeloggte Service darf platzieren). Später optional Cap `seat` / `host`.

## UI

### Einstieg A — Reservierungs-Timeline

- Karte einer `confirmed`-Reservierung: Primäraktion **„Platzieren“**.
- Andere Status: Aktion hidden/disabled (kein Place).

### Einstieg B — Tischplan

- Bestehender Reservierungs-Hinweis (z. B. „Res. in X min · Gast“) ist **tappbar**.
- Tippen öffnet denselben Place-Flow (Ziel-Reservierung aus Hint).

### Flow

1. Wenn `diningTableId` gesetzt und Tisch **frei** → direkt Hub-Seat.
2. Sonst **Tisch-Picker** (freie Tische; bevorzugt Kapazität ≥ Party).
3. Belegt / Race → Fehler „Tisch belegt“, Picker bleibt / Abbruch.
4. Busy-State; Erfolg → Sheet zu, Navigation zu `TableSessionView` des Tisches.
5. Covers vorausgefüllt aus `partySize` (nicht editieren in v1, außer wir brauchen einen Stepper — Default: **nicht editierbar**).

## Datenmodell / Hub

### LAN

Neu: `POST /v1/reservations/seat` (`PosLanProtocol.seatReservationPath`).

Request (Skizze):

```json
{
  "reservationId": "…",
  "diningTableId": "…",
  "coverCount": 4,
  "idempotencyKey": "…",
  "staffId": "…",
  "staffSessionId": "…"
}
```

Response: `{ "ok": true, "tableSessionId": "…", "diningTableId": "…" }` (oder Snapshot-Revision).

Fehler:

| Code | HTTP | Bedeutung |
|------|------|-----------|
| `invalid_status` | 400 | nicht `confirmed` |
| `table_occupied` | 409 | Tisch hat offene Session |
| `reservation_not_found` | 404 | unbekannt / falscher Tag-Cache |
| `table_not_found` | 404 | ungültiger Tisch |
| `staff_proof_required` | 403 | Production ohne Staff-Proof |
| `duplicate` / idempotent | 200 | gleicher Key → bestehende Session |

### Hub-Mutation (`PosHubState` / Runtime)

1. Idempotency: gleicher Key → bestehende Session-Id zurück, kein Doppel-Open.
2. Reservierung im Tages-Cache finden; Status muss `confirmed` sein.
3. Ziel-Tisch aktiv und **ohne** offene Session.
4. `openLocalSession` (oder bestehendes Open) mit `coverCount`; Session mit `reservationId` verknüpfen (lokales Meta falls Floor-Model noch kein Feld hat — mindestens Sync-Payload).
5. Reservierungs-Cache: Status → `seated`, `diningTableId` setzen falls geändert.
6. Snapshot bump → Handhelds sehen belegten Tisch + ggf. Resa-Update über Reservierungs-Endpoint/Cache.
7. Audit `reservation.seated`.
8. Sync-Queue Event (siehe unten).

### Handheld

- Online-Hub: `HandheldHubClient.seatReservation(…)` → Hub.
- Hub down / ungepaired: analog bestehender Open-Table-Policy (Hinweis / blockieren — **kein** zweites Outbox-Modell nur für Seat in v1, außer Open-Session-Outbox existiert bereits und kann `reservationId` tragen).

### Solo / Hub-Gerät

- Gleiche Mutation lokal (`shouldPublishLocalHubFloor`), dann Sync flush.

## Sync / Cloud

### Payload (Skizze)

`PosSyncReservationSeatedPayload` bzw. Erweiterung von `PosSyncOpenSessionPayload`:

- `restaurantId`, `tableSessionId`, `diningTableId`, `coverCount`
- `reservationId` (Pflicht)
- `idempotencyKey`

### Cloud-Verhalten

1. `POST /api/pos/table-sessions` mit `reservationId` (bereits unterstützt) — oder Nest-Äquivalent.
2. Reservierung auf `seated` setzen + `dining_table_id` angleichen (neues POS-API oder bestehende Display-Mutation unter POS-Auth — **eine** serverseitige Hilfsfunktion, von POS-Route genutzt).
3. Idempotent: erneuter Flush mit gleichem Key / bestehender Session+FK → no-op Erfolg.

Wenn nur Session-Open ohne Status-Update möglich wäre: **beide** Schritte sind Pflicht für „platziert“.

## Tests (Mindestsatz)

- Policy: nur `confirmed` seatbar; `pending`/`seated`/`cancelled` → reject.
- Belegter Tisch → `table_occupied`, keine Session.
- Freier zugewiesener Tisch → Session + Status `seated` im lokalen Cache.
- Idempotency-Key → eine Session.
- Staff-Proof: Production ohne Proof → 403; Cap kommt nicht aus spoofbarem Fremd-Profil (analog Void-Review).
- Sync-Payload Codable + enqueue einmal pro Key.

## Akzeptanz

1. Timeline: `confirmed`-Resa → Platzieren → freier Tisch → Session offen, Resa `seated`, UI in Tisch-Session.
2. Tischplan-Hinweis → gleicher Flow.
3. Belegter Tisch → klarer Fehler, keine Doppel-Session.
4. Handheld am Hub: Place über LAN, Floor aktualisiert auf beiden Geräten.
5. Nach Online-Sync: Cloud-Session hat `reservation_id`, Reservierung `seated`.

## Offene Punkte (bewusst klein)

- Exakter Sync-Event-Name (`reservation.seated` vs. `session.opened` mit Reservation) — Plan wählt einen, Nest/Next-Parity.
- Ob Floor-Snapshot `reservationId` an `openSessions` trägt — nice-to-have für UI; Sync-Payload reicht für v1.
