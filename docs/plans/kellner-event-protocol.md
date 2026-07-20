# Kellner / Hub — Event-Protokoll & Idempotency

Stand: Phase 0 · Juli 2026  
Bezug: [`kellner-swift-native-plan.md`](./kellner-swift-native-plan.md), Bonjour-Service **`_gwada-pos._tcp`** (`apps/pos`).

---

## 1. Rollen

| Akteur | Schreibt Events | Liest |
|---|---|---|
| iPhone (Kellner) | UI-Aktionen → Hub | Snapshot + Live-Push vom Hub |
| iPad Hub | Append-only Log (SoT im LAN) | Client-Commands; Outbox → Nest |
| NestJS `apps/pos-api` | Persistenz / Fiskaly / Mollie | Hub-Outbox bulk ingest |

Clients sprechen **primär den Hub**. Nest ist Cloud-Autorität und Sync-Ziel.

---

## 2. Envelope (jedes Event)

```json
{
  "eventId": "uuid",
  "idempotencyKey": "string",
  "restaurantId": "uuid",
  "deviceId": "uuid",
  "waiterId": "uuid|null",
  "sessionId": "uuid|null",
  "type": "session.opened",
  "ts": "2026-07-20T16:00:00.000Z",
  "schemaVersion": 1,
  "payload": {}
}
```

### Pflichtregeln

1. **`eventId`**: UUID v4, vom Erzeuger vergeben; im Hub-Log unique.
2. **`idempotencyKey`**: stabil für denselben Geschäftsvorgang (siehe §4). Nest und Hub deduplizieren darauf (mind. 72 h Fenster).
3. **`schemaVersion`**: Integer; Breaking Changes erhöhen und Migrationspfad im Hub/Nest.
4. **`ts`**: ISO-8601 UTC; Hub darf `receivedAt` zusätzlich speichern.
5. **Append-only**: nie mutieren/löschen. Korrekturen = neues Event (z. B. Storno als Gegenbuchung).
6. **Session-Bezug**: alles Tischbezogene trägt `sessionId` (nie nur Tischname).

---

## 3. Event-Typen (v1)

| `type` | Payload (Kern) | Wer |
|---|---|---|
| `device.enrolled` | `{ locationId }` | Nest → Hub Cache |
| `waiter.logged_in` | `{ waiterId, name, caps[] }` | Hub |
| `waiter.logged_out` | `{ waiterId }` | Hub |
| `shift.opened` | `{ waiterId, floatCents? }` | Hub → Nest |
| `shift.closed` | `{ waiterId, cashCountCents? }` | Hub → Nest |
| `session.opened` | `{ tableId, coverCount, reservationId?, ownerWaiterId }` | Hub |
| `order.line_added` | `{ lineId, itemId, qty, course, mods?, person? }` | Hub |
| `order.line_qty_changed` | `{ lineId, qty }` | Hub |
| `course.fired` | `{ course, lineIds[] }` | Hub (+ Druck) |
| `table.moved` | `{ fromTableId, toTableId, sessionId }` | Hub |
| `reservation.seated` | `{ reservationId, sessionId, tableId }` | Hub |
| `walk_in.seated` | `{ sessionId, tableId, coverCount }` | Hub |
| `settlement.mode_switched` | `{ from: "item", to: "amount" }` | Hub (Einbahnstraße) |
| `payment.completed` | `{ paymentId, amountCents, tipCents, method, tse?, allocations }` | Hub → Nest (TSE) |
| `session.transferred` | `{ fromWaiterId, toWaiterId, sessionIds[] }` | Hub (4-Augen) |
| `table.released` | `{ sessionId, tableId, waiterId }` | Hub |

Vollständige Payload-Schemas folgen in Nest DTOs (Phase 2); dieses Doc ist die **Konvention**.

---

## 4. Idempotency-Key-Konvention

Format: `{actor}:{action}:{businessId}[:{detail}]`

| Aktion | Beispiel-Key |
|---|---|
| Session öffnen | `hub:session.open:{localSessionId}` |
| Line add | `hub:line.add:{lineId}` |
| Course fire | `hub:course.fire:{sessionId}:{course}:{fireAttemptId}` |
| Zahlung | `hub:payment:{paymentId}` |
| Tisch freigeben | `hub:session.release:{sessionId}` |
| Transfer | `hub:session.transfer:{transferId}` |
| Outbox-Retry | **derselbe** Key wie Original — Nest antwortet 200 mit gespeichertem Result |

Nest-Endpoint (Ziel Phase 2): `POST /v1/sync/events` mit Array; Antwort pro Key: `applied | duplicate | rejected`.

---

## 5. Snapshot (Hub → Client)

Clients holen periodisch / nach Connect:

```json
{
  "snapshotVersion": 42,
  "restaurantId": "uuid",
  "brandAccentHex": "#EAB308",
  "tables": [],
  "sessions": [],
  "reservationsToday": [],
  "catalogVersion": "…",
  "waiterCaps": {}
}
```

Live-Updates = Events ab `snapshotVersion`. Bei Gap: Full Snapshot neu laden.

---

## 6. Offline / TSE

- Bestell-Events: lokal am Hub, Outbox wenn Nest erreichbar.
- **`payment.completed` mit TSE**: Nest/Fiskaly braucht Internet. Hub queued Zahlung; bei Ausfall UX blockiert oder Ausfallkennzeichnung (Policy Phase 2).
- Client-Fallback (Hub down): eigene Outbox → Nest (Phase 4 Feature-Flag).

---

## 7. Bonjour

- Service: `_gwada-pos._tcp` (bereits `apps/pos`)
- Port: Hub HTTP/WS (heute `8787` in `apps/pos` — Nest Cloud separat)
- Info.plist: `NSLocalNetworkUsageDescription`, `NSBonjourServices`

LAN-Protokoll des Hubs bleibt vorerst das in `apps/pos` implementierte HTTP-API; Event-Envelope oben ist die **Sync-/Domain-Norm** Richtung Nest und künftige WS-Push-Vereinheitlichung.
