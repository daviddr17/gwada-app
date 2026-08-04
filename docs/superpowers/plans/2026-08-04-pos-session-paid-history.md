# POS Session-Historie Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bezahlte Session-Positionen als Historie-Phase; Start/Zurück nach Spec `2026-08-04-pos-session-paid-history-design.md`.

**Architecture:** Ableitung aus Session-Belegen (`PosLocalReceipt.items`) + optionaler Disk-Cache pro `sessionId`. UI-Phase `history` neben `overview`/`ordering`.

**Tech Stack:** SwiftUI POS (`apps/pos`), XCTest

**Spec:** `docs/superpowers/specs/2026-08-04-pos-session-paid-history-design.md`

---

## File map

| File | Role |
|------|------|
| `Sources/Store/PosSessionPaidHistory.swift` | `PaidHistoryLine`, derive/merge from receipts, byCourse |
| `Sources/Store/PosPaidHistoryStore.swift` | Disk cache sessionId → lines; rebuild/clear |
| `Sources/Store/PosLocalStore.swift` | save/load paid-history JSON |
| `Sources/Store/PosOfflineCaches.swift` | `PosLocalReceiptLine.course` optional |
| `Sources/Store/PosSessionOverviewMath.swift` | `history` phase + `startPhase(open, historyNonEmpty)` |
| `Sources/UI/TableSessionHistoryView.swift` | Historie UI + Dock |
| `Sources/UI/TableSessionOverviewView.swift` | Historie-Chip |
| `Sources/UI/TableSessionView.swift` | Phase wiring |
| `Sources/Store/PosHubState.swift` / release | clear paid history on release |
| `Tests/.../PosSessionPaidHistoryTests.swift` | Unit tests |
| `Tests/.../PosSessionOverviewMathTests.swift` | startPhase matrix |

---

### Task 1: Domain math + receipt course

- [x] Extend `PosLocalReceiptLine` with `course: Int?` (default nil for decode)
- [x] `makeReceipt` sets `course` from `SessionOpenLine.course`
- [x] Add `PosSessionPaidHistory` with `rebuild(receipts:)`, `mergeKey`, `byCourse`
- [x] Tests: empty; one receipt; two partial pays merge qty; voided excluded
- [x] Verify: unit tests pass

### Task 2: Cache store + clear on release

- [x] `PosLocalStore` save/load `[String: [PaidHistoryLine]]`
- [x] `PosPaidHistoryStore` rebuild/save/load/clear/prune
- [x] Clear in `releaseLocalSession` (+ draft already cleared)
- [x] Verify: unit tests for clear + disk roundtrip

### Task 3: startPhase + Overview chip

- [x] `PosSessionPhase.history`
- [x] `startPhase(openLines:historyNonEmpty:)`
- [x] Update existing tests; add matrix cases
- [x] Overview: `historyLineCount` + `onOpenHistory` chip

### Task 4: History view + TableSessionView wiring

- [x] `TableSessionHistoryView`
- [x] Wire phases, toolbar, post-Kassieren phase, refresh history on appear/paid
- [x] `showSessionOverview` only when `phase == .overview` (open lines drive content)
- [x] Build + unit tests

### Task 5: Smoke

- [ ] Manual: pay → history visible; release → ordering next visit

---

## Done when

Akzeptanzkriterien 1–9 der Spec erfüllt; Unit-Tests grün; Build OK.
