# POS Security + Performance Review (2026-08-02)

Scope: `apps/pos` on branch `cursor/pos-layout-parity-2026-07-30`.  
Sources: Security review `f4bd9d18-e255-42d0-b7cd-589c4d27d139`, Performance review `cabd28e6-f2d5-4490-9dd7-d24c7fdf0f0f`.

**Next product work after fixes:** Hub-Offline Phase 1 (`docs/plans/2026-08-02-pos-hub-offline-outbox.md`).

---

## Security

No critical remote cross-tenant issues in the branch diff. Highest risks: payment/fiscal control-plane and LAN trust.

| Sev | Finding | Where | Fix direction |
|-----|---------|-------|---------------|
| HIGH | Synthetic fiscal receipts (fake TSE) without cloud/PIN | `PosReceiptFiscalDemo`, `collectSplit`, guest receipt UI | Demo TSE only `#if DEBUG`; production fail-closed until cloud/TSE OK |
| HIGH | Hub `POST /v1/collect` clears lines with pair token only — no payment/PIN/TSE | `handleHubRequest` collect, `collectLocalLines` | Require payment proof / staff PIN / proxy to cloud settlement |
| MED | LAN pair tokens plaintext (UserDefaults + JSON) | `PosEnrollmentStore`, `PosPairingStore` | Keychain; hub stores hashed tokens |
| MED | Handheld marks paid if hub collect fails | `collectSplit` | Hub-first / rollback; no guest receipt until confirm |
| MED | Cloud line-ID mapping removed | deleted `PosOrderLineIdMap` | Restore map or block cloud collect until server IDs |
| MED | Offline payment always succeeds locally | `collectSplit` | Split demo vs production gates |

**Verified OK:** collect requires pair token; `debug-approve-all` is `#if DEBUG`; enrollment device token in Keychain; cloud payment APIs still PIN-gated.

**Pre-existing:** `/v1/kds/tickets` + `/v1/kds/tickets/advance` open on LAN (no token).

### Security fix order
1. Gate demo fiscal receipts + harden hub collect for non-demo.
2. Pair tokens → Keychain / hashed hub store.
3. Collect atomicity + cloud line-ID mapping.

---

## Performance

| Sev | Finding | Where | Fix direction |
|-----|---------|-------|---------------|
| P0 | Full snapshot encode (floor+menu) on serial Hub HTTP queue + lock | `HubHTTPServer`, `makeSnapshot`, GET `/v1/snapshot` | Cache encode by `snapshotVersion`; drop `sortedKeys`; floor/menu split |
| P0 | Disk I/O under `PosHubState` lock | `saveBootstrap` from floor mutations | Copy under lock, async write |
| P0 | `@Published snapshot` always assigns → tree-wide SwiftUI churn | `publishSnapshot` | Equality guard; separate floor vs menu publishers |
| P0 | Handheld full snapshot after every open/send | `sendCartViaHub`, `openTable` | Optimistic patch; delta responses |
| P1 | KDS 2s JSON roundtrip poll | `KdsView` | Revision-gated / in-memory / push |
| P1 | Open-lines not persisted on release | `releaseLocalSession` | Persist prune |
| P1 | Unbounded sync queue + 20s status churn | `PosSyncQueue`, `startPeriodicFlush` | Cap; quiet flush |
| P1 | Floor O(tables×reservations) + 30s tick | `TablesHomeView` | Index lookups |
| P1 | Single-threaded Hub HTTP | `HubHTTPServer` | Per-connection queues |

### Perf fix order
1. Unlock disk + snapshot response cache.
2. Stop republishing full menu on floor bumps.
3. Stop full handheld snapshot after mutations.
4. KDS revision-gated poll.
5. Floor index + openLines persist + sync hygiene.

---

## Suggested batching

| Batch | Contents | Status |
|-------|----------|--------|
| A — Security P0 | Demo TSE gate, hub collect hardening | **Done** (2026-08-02) |
| B — Security P1 | Keychain tokens, collect atomicity, line-ID map | **Done** (2026-08-02) |
| C — Perf P0 quick wins | Snapshot cache, async persist, publish equality | **Done** (2026-08-02) |
| D — Hub Phase 1–5 | Offline plan Hub-Pflicht → Sync-Queue harden | **Done** (2026-08-02) |

**Nächstes Review (Security / Bugs / UI):** Plan Phase 1–6 ist fertig — **jetzt** sinnvoll (Security / Bugs / UI-Glitches). Fokus: Sync-Queue FIFO poison, doppelte Zahlungen LAN↔Cloud, Konflikt-Sheet + Reconnect, fiscalPending-UI, Bonjour-Glitches.
