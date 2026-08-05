# POS Positions-Storno (Line Void) — Design

**Datum:** 2026-08-05  
**Status:** Approved  
**Ansatz:** Hub-LAN SoT + Sync-Queue → Cloud (Ansatz 2)  
**Branch-Kontext:** `apps/pos` · Roadmap: Storno → Seat → Merge → Handover → Move LAN  
**Bezug:** Bar-Beleg-Storno (`ReceiptsView` / `pos_void_reasons`), Fire/KDS (`/v1/fire`), Outbox-Modell

## Problem

Nach dem Schicken (und ggf. Feuern) sind offene Positionen in der Session-UI praktisch read-only. Falsch bestellt / Gast ändert Meinung / Küche braucht Cancel — heute nur Cart vor Send oder Bar-Storno **nach** Zahlung. Lightspeed-Kellner können Teilmengen mit Grund stornieren und die Küche benachrichtigen.

## Ziele

1. **Teil- oder Voll-Storno** offener Qty einer geschickten Position.
2. Auch **nach Fire** möglich (mit strengeren Caps).
3. **Pflicht-Grund** aus `pos_void_reasons` + optionale Notiz.
4. **Küchen-Storno** (KDS + Print) nur wenn die stornierte Menge schon gefeuert war.
5. Hub bleibt **Source of Truth**; Handheld über LAN; Offline über Outbox wie Orders.
6. Audit + Sync-Event für Cloud/Web.

## Nicht-Ziele (dieser Slice)

| Thema | Umgang |
|-------|--------|
| Weitere Zahlarten | Zurückgestellt (Roadmap) |
| Comp / Rabatt / 0€-Linie | Später (P2) |
| Bar-Beleg-Storno ändern | Bleibt wie heute |
| Force-Abort ganzer Tisch nach Fire | Folgt später, baut auf Line-Void auf |
| Tisch mergen / Move / Seat / Handover | Nächste Roadmap-Items |
| Cloud-only Void ohne Hub | Nein — widerspricht Offline-Modell |

## Entscheidungen (bestätigt)

| # | Thema | Wahl |
|---|--------|------|
| 1 | Scope | **C** — Teilmenge + volle Qty; auch nach Fire |
| 2 | Caps | **C** — ungefeuert: jeder Kellner; gefeuert: Cap `void` |
| 3 | UI-Einstieg | **C** — Swipe + Long-press |
| 4 | Küchen-Ticket | **A** — nur wenn stornierte Menge gefeuert war |
| 5 | Gründe | **C** — `pos_void_reasons` + optionale Notiz |
| 6 | Datenpfad | **Ansatz 2** — Hub-LAN SoT + Sync-Queue |

## Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Geschickt** | Open-Line existiert (`SessionOpenLine`, `openQuantity > 0`) |
| **Gefeuert** | Gang der Line ist gefeuert (`firedAt` gesetzt bzw. `hasFired(session, course)`) |
| **Storno-Qty** | 1…`openQuantity` |
| **Küchen-relevant** | Storno-Qty betrifft bereits gefeuerte Menge → KDS/Print-Storno |

## Caps

- Cap-Slug: **`void`** (Snapshot `waiterCaps` / `PosWaiterPinCache`).
- **Ungefeuert:** Storno erlaubt ohne `void`.
- **Gefeuert:** Storno nur mit Cap `void`; sonst Aktion disabled + Hinweis „Nur mit Storno-Recht“.
- Hub prüft Caps serverseitig (LAN-Request + Waiter-Profil aus Pair/PIN); DEBUG-Solo: Cap aus Cache oder DEBUG-Bypass analog bestehender Policy.

## UI

### Einstieg

- Session-Übersicht (offene Positionen): **Swipe links** → „Stornieren“.
- **Long-press** → Kontextmenü „Stornieren…“.
- Cart / ungeschickt: unverändert Qty± (kein Line-Void-Event).

### Sheet „Position stornieren“

1. Positionsname + aktuelle offene Menge.  
2. **Stepper** Storno-Menge (Default = volle `openQuantity`, Min 1).  
3. **Grund-Picker** (cached `pos_void_reasons`, Pflicht wenn Liste nicht leer).  
4. Optional **Notiz** (kurz, z. B. ≤80 Zeichen).  
5. Primär: „Stornieren“ (destruktiv); Abbrechen.  
6. Busy/Fehlerzeile; Erfolg → Sheet zu, Overview refreshed.

### Sichtbarkeit

- Zeile mit `openQuantity == 0` erscheint nicht mehr als offen (wie nach Collect).
- Optional später: Storno-Historie — **nicht** in v1 (Audit reicht).

## Datenmodell / Hub

### LAN

Neu: `POST /v1/lines/void` (Name in `PosLanProtocol`, z. B. `voidLinePath`).

Request (Skizze):

```json
{
  "sessionId": "…",
  "lineId": "…",
  "quantity": 1,
  "voidReasonId": "…",
  "note": "optional",
  "waiterProfileId": "…",
  "idempotencyKey": "…"
}
```

Response: aktualisierte Open-Lines / Snapshot-Revision oder `{ "ok": true, "openQuantity": n }`.

Fehler: `400` invalid qty/reason, `403` missing void cap (fired), `404` line/session, `409` conflict (qty zu groß / schon kassiert).

### Hub-Mutation (`PosHubState`)

1. Idempotency: gleicher Key → no-op Erfolg.  
2. Line finden; `quantity` ∈ 1…`openQuantity`.  
3. Cap-Check wenn Line/Course gefeuert.  
4. `openQuantity -= quantity`; bei 0 Line entfernen (oder Qty 0 + prune).  
5. Session-Meta `openCents` anpassen.  
6. Wenn küchen-relevant: KDS-Storno-Ticket + Print-Job „STORNO“ (gleiche Printer-Route wie Fire).  
7. Audit `order.line_voided`.  
8. Sync-Queue Event `order.line_voided` (Payload: restaurantId, sessionId, lineId, qty, voidReasonId, note, fired, waiterProfileId, idempotencyKey).  
9. Snapshot bump → Handhelds sehen Update.

### Handheld

- Online-Hub: `HandheldHubClient.voidLine(…)` → Hub.  
- Hub getrennt + paired: Outbox-Event (neues Kind analog `createOrder`); Flush bei Reconnect; Hard-Reject Sheet bei Session weg.  
- Solo DEBUG: lokale HubState-Mutation ohne LAN.

### Cloud / Nest

- Sync-Event → Nest oder Next `/api/pos` (bestehendes Flush-Muster).  
- Web-Inventar/Order-Status: bestehendes Void-Reasons-Schema; Line-Void-Persistenz minimal (Event-Log / Order-Line Status) — Detail im Implementierungsplan, Schema nur wenn nötig.

### Gründe-Cache

- Reuse `PosCloudClient.fetchVoidReasons` + `PosOfflineCaches` void-reasons File (wie Receipts).  
- Offline: letzte gecachte Gründe; wenn leer → Storno blockieren mit „Gründe fehlen — einmal online“.

## Edge Cases

| Fall | Verhalten |
|------|-----------|
| Teilzahlung schon auf Line | Nur Rest-`openQuantity` stornierbar |
| Qty > open | 409 / UI clamped |
| Doppel-Tap | IdempotencyKey |
| Fire während Sheet offen | Cap-Re-Check beim Submit |
| Alle Lines storniert, openCents 0 | Tisch freigebbar wie heute (kein Auto-Release) |
| Kein Cap, Line gefeuert | Submit disabled |
| Hub offline, Outbox full | Bestehende Outbox-Limits / Soft-Fail |

## Testplan (Acceptance)

1. Schicken ohne Fire → Storno volle Qty → Line weg, **kein** Küchen-Storno.  
2. Schicken + Fire → Storno ohne Cap `void` → abgelehnt.  
3. Mit Cap `void` → Teilmenge 1 von 3 → openQty 2; KDS/Print-Storno einmal.  
4. Swipe und Long-press öffnen dasselbe Sheet.  
5. Grund Pflicht; Notiz optional gespeichert im Audit/Event.  
6. Handheld → Hub LAN Roundtrip; Snapshot aktualisiert.  
7. (DEBUG) Solo lokaler Storno ohne Crash.

## Offene Punkte für den Plan (nicht blockierend)

- Exact Nest Event-Schema vs. Next Route.  
- Ob `firedAt` pro Line oder nur Course-Level Fire die „küchen-relevant“-Logik treibt (Code-Ist prüfen: `markLocalCourseFired` / Line `firedAt`).  
- UIKit Swipe vs. SwiftUI `swipeActions` auf Overview-Rows.
