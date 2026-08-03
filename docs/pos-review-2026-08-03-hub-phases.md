# POS Review — Security / Bugs / UI (nach Hub Phase 1–6)

> **Datum:** 2026-08-03  
> **Branch:** `cursor/pos-layout-parity-2026-07-30`  
> **Scope:** `apps/pos` (+ `apps/pos-api` Sync-Zeilen-IDs) + Next `collect-cash-allocations`  
> **Tests:** `GwadaPOSTests`  
> **Status Optimierung:** Batch **A** + **B** + Next Steps **P1-4 / P1-5 / P1-7 / P2-2** (2026-08-03)

Quellen: Security-Review ([Security review POS hub](160a38e8-a7cb-4d32-b153-c4c785610b44)), Korrektheits-Audit Hub-Offline, Mehr-/Gerät-UX-Audit, Code-Verifikation.

**Security-Review bestätigt positiv:** Pair-Token Keychain + Hub-Hashes, `/v1/collect` bearer-geschützt, Release Staff-Gate, Demo-TSE nur DEBUG, Outbox Hard-Reject.

### Batch A+B erledigt
- P0-1 settle atomar + enqueue nur bei `paid > 0`
- P0-4 / P1-1 LAN settle nur **cash**; voucher/card/paypal auf LAN abgelehnt
- P0-2/3 Floor-Wipe: Handgerät kein `makeSnapshot`; Freigeben/Feuern/Umziehen gated
- P1-2 Handgerät: `markReceiptSynced` nach Hub-Bar-Collect
- Mehr: Nest/Audit/Übergabe/Triplikate weg; Nest-Editor nur DEBUG; Support Hub-IP hinter Disclosure

### Next Steps erledigt (P1-4/5/7, P2-2 light)
- **P1-4:** Next `collectCash` sendet `paymentAttemptId` + `Idempotency-Key`; Server `pos_payments.client_attempt_id` (Migration + Lookup); Sync-Queue **Dead-Letter** bei permanent 4xx / `missingConfig` / `maxFlushAttempts` — Offline/5xx bleibt FIFO-Stop
- **P1-5:** `publishSnapshot` Equality inkl. `hub.deviceId`
- **P1-7:** KDS Tickets/Advance brauchen `X-Gwada-Pos-Lan-Secret` (`PosHubLanSecret`); HTML injiziert Secret; CORS erlaubt Header
- **P2-2:** Reconnect-Loop erste Suche nach ~8s, dann 45s

---

## Kurzfazit

Der Hub-Offline-Pfad (Phases 1–6) ist funktional geschlossen und getestet. Restrisiken: **TLS/Pair-Token** (P2-1), echte Unbar-Provider-Flows, Fiskaly TSE.

---

## P0 — Sofort (Korrektheit / Geld)

| ID | Finding | Status |
|----|---------|--------|
| **P0-1** | Collect TOCTOU / enqueue ohne paid | **erledigt** (Batch A) |
| **P0-2** | Floor-Wipe Freigeben | **erledigt** (Batch A) |
| **P0-3** | Floor-Wipe Feuern | **erledigt** (Batch A) |
| **P0-4** | Voucher LAN ohne Validierung | **erledigt** — LAN nur cash |

---

## P1 — Hoch (Sicherheit / Sync / Ops)

| ID | Finding | Status |
|----|---------|--------|
| **P1-1** | Card/PayPal vor Provider | **mitigiert** — LAN cash-only |
| **P1-2** | fiscalPending Handgerät | **erledigt** (Batch A) |
| **P1-3** | Move/Release/Fire Ops-Gates | teilweise (Floor-Gates); Nest-Move weiter Tech-Debt |
| **P1-4** | FIFO poison / Next ohne Attempt-ID | **erledigt** (Dead-Letter + client_attempt_id) |
| **P1-5** | publishSnapshot Version-only | **erledigt** (+ hub.deviceId) |
| **P1-6** | Nest-UI Release | **erledigt** (Batch B, DEBUG-only) |
| **P1-7** | KDS ohne Auth | **erledigt** (LAN-Secret) |
| **P1-8** | Gutschein Handheld nach Hub | mitigiert durch cash-only Hub-Collect |

---

## P2 — Mittel / UX / Tech-Debt

| ID | Finding | Status |
|----|---------|--------|
| **P2-1** | Cleartext HTTP + langlebiger Pair-Token | **erledigt** — Hub HTTPS + Pin; Token 8h + Refresh |
| **P2-2** | Reconnect erste Suche ~45s | **teilweise** — erste Suche ~8s |
| **P2-3** | Soft-Fail Outbox nur Statuszeile | offen / by design |
| **P2-4** | Pair status unauth | offen |
| **P2-5** | DEBUG-Policy-Gates | OK in Release |
| **P2-6** | Caps-Default / Audit | Caps bereinigt in Mehr |

---

## Tests

```
GwadaPOSTests — 96 executed, 0 failures (2026-08-03, Next Steps)
```

Unit-Coverage gut für Outbox/Queue/Security-Batches; **keine** Integrationstests für Collect-Race oder Floor-Wipe nach Freigeben.

---

## Bewusst OK (nicht wieder öffnen)

- Hub-Pflicht + Solo nur DEBUG  
- Offline: bestellen aus Cache, kein neues Open/Resa-Write, kein Kassieren ohne Hub  
- Handheld Collect → Hub SoT, kein paralleler Handheld-Cloud-Collect  
- Hard-Reject → Conflict-Sheet + Rollback  
- FIFO-Stop bei **temporären** Sync-Fehlern; Dead-Letter bei permanenten  
- Demo-TSE nur DEBUG  

---

## Als Nächstes (optional)

1. **P2-1** TLS LAN + kurze Pair-Tokens  
2. Card/PayPal echte Pending-until-Provider (Cloud)  
3. Hub-LAN APIs für Release/Fire vom Handgerät  
4. Fiskaly TSE (Vermerk 2b)  
