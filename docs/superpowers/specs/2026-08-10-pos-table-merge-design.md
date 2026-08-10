# POS Tisch mergen (Session Merge) — Design

**Datum:** 2026-08-10  
**Status:** Approved (Produkt) · Spec zur Review  
**Ansatz:** Hub-LAN SoT + Sync-Queue → Cloud (Ansatz 1 / wie Void & Seat)  
**Branch-Kontext:** `apps/pos` · Roadmap: Storno → Seat → **Merge** → Handover → Move LAN  
**Bezug:** `MoveSessionSheet` / `moveLocalSession` (nur **freier** Ziel-Tisch), Kassieren-Lock (`PosKassierenLockState`), Open-Lines (`SessionOpenLine`), Fire/KDS

## Problem

Zwei belegte Tische sollen zu **einer** Rechnung / Session zusammengeführt werden (Lightspeed-nah). Heute gibt es nur **Tisch verschieben**: ganze Session auf einen **freien** Tisch. Belegtes Ziel wird abgelehnt. Kellner brauchen: Quelle starten → Ziel wählen → Positionen + Gäste auf dem Überlebenden, Quelltisch frei.

## Ziele

1. **Voll absorbieren:** alle offenen Positionen der Quell-Session wandern zur Ziel-Session; Quell-Session endet; Quelltisch wird frei.
2. Einstieg nur aus der **offenen Session** (Overflow/Mehr → „Tisch mergen“).
3. Nutzer wählt explizit den **Ziel-Tisch** (Überlebender); Start-Tisch = Quelle.
4. `cover_count` der Ziel-Session = **Summe** beider Covers.
5. Bereits **gefeuerte** Lines 1:1 mitnehmen (Course / `firedAt` bleiben); KDS hängt danach am Ziel-Tisch.
6. Merge **blockieren**, wenn Quelle oder Ziel einen **Kassieren-Lock** hat.
7. Hub bleibt **Source of Truth**; Handheld über LAN; Sync-Queue → Cloud.

## Nicht-Ziele (dieser Slice)

| Thema | Umgang |
|-------|--------|
| Teil-Merge (nur ausgewählte Lines/Gäste) | Nein — später optional |
| Soft-Link zweier Sessions | Nein |
| Einstieg vom Floor (Long-Press) | Nein — nur Session-Menü |
| Undo-Merge | Nein in v1 |
| Merge trotz Kassieren-Lock | Nein |
| Tisch verschieben ersetzen | Bleibt parallel (`MoveSessionSheet`, freies Ziel) |
| Handover (Kellner-Wechsel) | Nächstes Roadmap-Item |
| Cloud-only Merge ohne Hub | Nein — Offline-Modell |

## Entscheidungen (bestätigt)

| # | Thema | Wahl |
|---|--------|------|
| 1 | Semantik | **A** — Quell-Session vollständig in Ziel absorbieren |
| 2 | Überlebender | **A** — Nutzer wählt Ziel; Start-Session = Quelle |
| 3 | Kassieren-Lock | **A** — Merge nur wenn **beide** ohne Lock |
| 4 | Covers | **A** — Summe (manuell nachziehbar über bestehende Cover-UI) |
| 5 | UI-Einstieg | **A** — nur Session → Mehr → Mergen |
| 6 | Gefeuerte Lines | **A** — 1:1 mitnehmen |
| 7 | Datenpfad | **Ansatz 1** — Hub-LAN SoT + Sync-Queue |

## Begriffe

| Begriff | Bedeutung |
|---------|-----------|
| **Quelle** | Session, von der „Tisch mergen“ gestartet wird (`sourceSessionId`) |
| **Ziel / Überlebender** | Gewählte belegte Session; behält `sessionId` und Tisch (`targetSessionId`) |
| **Absorbieren** | Open-Lines der Quelle → Ziel; Covers summieren; Quelle freigeben |
| **Kassieren-Lock** | `PosKassierenLockState` an der Session (Positions- oder Anteil-Kassieren aktiv) |
| **Belegt** | Floor hat offene Session auf dem Tisch |

## Caps / Auth

- LAN-Mutation analog Move/Void/Seat: in Production **Staff-Proof** (`X-Gwada-Staff-Id` / Session-Header); DEBUG-Lab darf bestehende Bypass-Policy nutzen.
- Kein separates Cap-Slug für Merge in v1 (jeder eingeloggte Service darf mergen). Später optional Cap `merge`.

## UI

### Einstieg

- `TableSessionView` Overflow/Mehr-Menü: Aktion **„Tisch mergen“** (neben Verschieben).
- Accessibility-ID: `pos.session.mergeMenu`.

### Sheet „Tisch mergen“

1. Kurzer Hinweis: Positionen und Gäste wandern zum gewählten Tisch; dieser Tisch wird frei.
2. Liste **anderer belegter** Tische (Name/Nummer + Covers + optional offener Betrag).
3. Tip auf Ziel → Bestätigen (destruktiv/prominent) / Abbrechen.
4. Busy-State + Fehlerzeile (`kassieren_active`, `same_session`, …).
5. Erfolg → Sheet zu; Navigation bleibt auf **Ziel-Session** (wenn UI noch auf Quelle war: zur Ziel-Session wechseln bzw. Floor → Ziel öffnen).

### Sichtbarkeit

- Aktion disabled/hidden wenn &lt; 2 belegte Tische im Floor.
- Ziel-Picker zeigt nur Sessions **ohne** Kassieren-Lock; wenn Quelle selbst Lock hat → Sheet mit Fehler / Aktion disabled.

## Datenmodell / Hub

### LAN

Neu: `POST /v1/sessions/merge` (`PosLanProtocol.mergeSessionsPath` o. Ä.).

Request (Skizze):

```json
{
  "sourceSessionId": "…",
  "targetSessionId": "…",
  "idempotencyKey": "…",
  "staffId": "…",
  "staffSessionId": "…"
}
```

Response: `{ "ok": true, "targetSessionId": "…", "coverCount": N }` (optional Snapshot-Revision).

Fehler:

| Code | HTTP | Bedeutung |
|------|------|-----------|
| `same_session` | 400 | Quelle = Ziel |
| `source_not_found` / `target_not_found` | 404 | unbekannte Session |
| `kassieren_active` | 409 | Lock auf Quelle und/oder Ziel |
| `staff_proof_required` | 403 | Production ohne Staff-Proof |
| `duplicate` / idempotent | 200 | gleicher Key → bereits gemergter Zustand |

### Hub-Mutation (`PosHubState.mergeLocalSessions`)

Unter Hub-Lock, atomar:

1. **Idempotency:** gleicher Key → Erfolg mit bestehendem Ziel-Zustand, keine Doppel-Lines.
2. Quelle und Ziel laden; `sourceSessionId != targetSessionId`.
3. Beide existieren in `openSessions`.
4. `kassierenLock(source)` und `kassierenLock(target)` müssen **nil** sein.
5. Open-Lines der Quelle an Ziel anhängen:
   - Lines behalten inhaltliche Felder (Item, Qty, Cents, Course, `firedAt`, Notes, …).
   - Line-IDs: **neue** Client-/Hub-Line-IDs vergeben, wenn das Modell Session-scoped IDs verlangt; sonst umhängen — Plan wählt konsistent zu Void/Collect (keine ID-Kollision mit Ziel).
6. `cover_count` Ziel = `max(1, source.cover_count + target.cover_count)`.
7. Floor-Meta Ziel: `orderCount` / `openCents` neu berechnen (Summe bzw. aus Lines).
8. Fire-State: gefeuerte Courses der Quelle mit Ziel mergen (`firedCourses` union), dann Quelle clearen.
9. Quelle **release**-ähnlich entfernen: Session aus Floor, Lines/Locks/Drafts der Quelle weg; **ohne** die Ziel-Daten zu löschen.
10. Snapshot bump; Bootstrap + Open-Lines persistieren.
11. Audit `session.merged`.
12. Sync-Queue Event enqueue.

### Handheld

- Online-Hub: `HandheldHubClient.mergeSessions(…)` → Hub.
- Hub down: analog Move/Open — Hinweis / blockieren; kein zweites Cloud-Bypass-Merge in v1.

### Solo / Hub-Gerät

- Gleiche Mutation lokal (`shouldPublishLocalHubFloor`), dann Sync flush.

## Sync / Cloud

### Payload (Skizze)

`PosSyncSessionMergedPayload`:

- `restaurantId`
- `sourceSessionId`, `targetSessionId`
- `sourceDiningTableId`, `targetDiningTableId`
- `coverCount` (nach Merge)
- `movedLineIds` oder Line-Diff (Plan: minimal — Cloud kann Orders der Quelle auf Ziel-Session umhängen)
- `idempotencyKey`

### Cloud-Verhalten

1. Nest/Next: Orders/Lines der Quell-`table_session` der Ziel-Session zuordnen; Quell-Session schließen/`merged` markieren (kein `db reset`, nur Status).
2. `cover_count` am Ziel aktualisieren.
3. Idempotent: erneuter Flush mit gleichem Key → no-op Erfolg.
4. Event-Name Vorschlag: `table.merged` (Parity zu `table.moved`).

Wenn Cloud in v1 noch keinen Merge-Endpoint hat: Hub-lokal + Sync-Queue speichern; Cloud-Handler im gleichen Slice nachziehen (wie Seat) — **Pflicht** für Online-Parity, nicht „nur lokal“.

## KDS / Fire

- Lines behalten `firedAt` / Course.
- Nach Snapshot: KDS/Tickets für Ziel-Tisch-Label; keine erneute Fire-Aktion nötig.
- Kein separates Küchen-„Tischwechsel“-Ticket in v1 (Entscheidung A).

## Reservierung

- Quell-Session mit `reservationId`: FK bleibt an der **geschlossenen** Quell-Session bzw. wird laut Cloud-Regeln nicht automatisch auf Ziel umgehängt in v1 (kein Doppel-Seat). UI-Hinweis optional später.
- Ziel behält eigene Reservation-FK unverändert.

## Tests (Mindestsatz)

- Merge zweier Sessions → eine Session, Lines summiert, Covers Summe, Quelltisch frei.
- Kassieren-Lock Quelle oder Ziel → `kassieren_active`, keine Mutation.
- Quelle = Ziel → `same_session`.
- Idempotency-Key → kein doppeltes Line-Append.
- Gefeuerte Line der Quelle bleibt gefeuert am Ziel.
- Staff-Proof Production ohne Proof → 403.
- Sync-Payload Codable + enqueue einmal pro Key.

## Akzeptanz

1. Session A → Mehr → Tisch mergen → Tisch B wählen → bestätigen.
2. Alle Positionen von A sichtbar in B; Covers = A+B; Tisch A frei.
3. Mit Lock auf A oder B → klarer Fehler, nichts verändert.
4. Handheld am Hub: Merge über LAN, Floor auf beiden Geräten aktuell.
5. Nach Sync: Cloud hat eine offene Session (Ziel) mit zusammengeführten Orders.

## Offene Punkte (bewusst klein)

- Exakte Line-ID-Strategie beim Umhängen (neu vs. reuse) — Plan entscheidet gegen Kollisionen.
- Cloud-Endpoint-Pfad (`POST …/sessions/merge` vs. Event-only Flush) — eine Variante im Plan.
- Ob Draft-Cart der Quelle verworfen oder gemerged wird — **Default: verwerfen** (nur geschickte Open-Lines zählen).
