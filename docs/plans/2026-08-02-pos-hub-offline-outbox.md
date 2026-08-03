# POS: Hub-Pflicht + Handheld-Offline-Outbox (Lightspeed-nah)

> **Status:** Phase 1–6 implementiert (2026-08-02 / 2026-08-03) — Plan abgeschlossen  
> **Branch:** `cursor/pos-layout-parity-2026-07-30`  
> **App:** `apps/pos`  
> **Datum:** 2026-08-02  
> **Verwandt:** `docs/plans/pos-ipad-lan-hub.md`, Layout-Parity unter `docs/superpowers/plans/2026-07-30-pos-layout-parity.md`

---

## Zielbild

```text
iPhone: Cache (Menü, offene Tische) + Outbox
   ↕ Bonjour / :8787  (online: live | offline: lokal → Flush)
iPad: SoT + Sync-Queue + (später) Fiskaly TSE
   ↕ Internet
Cloud / TSE
```

1. **iPad = Kasse** (einzige operative SoT für Floor/Orders/Kassieren/TSE-Pfad).
2. **iPhone** findet iPad per **Bonjour** (`_gwada-pos._tcp`, Port **8787**), koppelt einmal (Token bis Widerruf).
3. Nach erfolgreichem Start: iPhone arbeitet **session-offline** weiter, wenn iPad kurz weg ist.
4. Transaktionen liegen in einer **Handheld-Outbox** und werden an das iPad **geflusht**, sobald es wieder in Reichweite ist.
5. iPad queued weiter und schickt an **Cloud/Fiskaly**, sobald Internet da ist.

Cloud-Enrollment am iPhone nur zum **Bootstrappen** (Gerät, Restaurant, erster Menü-Preload) — nicht als parallele Live-SoT neben dem Hub.

---

## Entscheidungen (verbindlich)

| # | Thema | Entscheidung |
|---|--------|--------------|
| 1 | Produktiv | **Hub Pflicht** nach Onboarding. Cloud-Solo nur DEBUG/Notfall. |
| 2 | Hub kurz weg | **Bestellen + offene Tische** aus Cache; **Kassieren gesperrt**. |
| 2b | TSE-Vermerk offline | **Geparkt** — DE erlaubt Vermerk bei TSE-Unerreichbarkeit; später prüfen (ggf. erweitertes Kassieren offline). Bis dahin: ohne Hub kein Kassieren. |
| 3 | Kassieren bei Hub online | iPhone **darf** kassieren → LAN → iPad → Fiskaly. |
| 4 | Flush-Konflikte | **Merge additiv** (Orders); hart (Tisch zu / Session weg) → Ablehnen + Snapshot neu laden. |
| 5 | Onboarding iPhone | Cloud-Code → Menü-Preload → **Pflicht-Bonjour/Hub-Freigabe** → erst dann Service. |
| 6 | Neue Tische offline | **v1: nein** — nur bereits offene Sessions aus letztem Snapshot. |
| 7 | Speisekarte | Im Betrieb **nur vom Hub**; Cloud nur Enrollment-Preload. |
| 8 | Hubs pro Restaurant | **v1: ein iPad** = eine Kasse / eine TSE-Wahrheit. |
| 9 | Reservierungen offline | **Nur lesen** aus letztem Hub-Snapshot; anlegen/ändern **nur mit Hub**. |
| 10 | Outbox-Dauer | **Kein hartes Zeitlimit** — Events bleiben bis Flush. Ab **~45 Min** ohne Hub: stärkerer Banner + Badge „n ausstehend“. Am Tages-/Schichtende am iPad: Warnung, wenn Handgeräte noch ungesynct. |

### Backend / Datenbank

- iPad-Hub spricht mit **Next/API → VPS Dev-Supabase** (`.env.development`). **Keine** lokale Docker-Postgres im Alltag.
- Offline = Geräte-Caches + Outbox auf iPhone/iPad; Sync zur Remote-DB nur wenn iPad Internet hat.

---

## Ist-Stand (kurz) — Gaps

| Erwartung | Heute |
|-----------|--------|
| Hub Pflicht | Cloud-Solo ist Primärpfad; Pairing optional |
| Handheld-Outbox → Hub | **Fehlt** — bei Hub-Wegfall Solo/Fehler, kein Flush |
| Menü nur Hub nach Pair | Cloud-Refresh / Solo parallel möglich |
| Fiskaly am Hub | Demo-TSE + Web-Stubs; Queue → Nest/Next, kein echtes TSE-SDK |

Schlüsseldateien: `PosRuntime.swift`, `PosEnrollmentStore.swift`, `PosHubState.swift`, `PosSyncQueue.swift` (heute Cloud, nicht Hub), `BonjourHub*`, `HandheldHubClient.swift`, `HubHTTPServer.swift`.

---

## Implementierungsphasen

### Phase 1 — Hub-Pflicht & Pairing-Gate ✅
- Nach Cloud-Code: kein Service ohne erfolgreiche Hub-Freigabe (`isHandheldServiceReady` = paired).
- Solo nur `#if DEBUG` / `PosSecurityPolicy.allowsSoloMode`.
- Banner „Kasse getrennt“ wenn paired aber Hub down; Kassieren in dem Zustand gesperrt.
- Pairing-Token bleibt bis Widerruf (Reconnect ohne erneutes Freigeben).

### Phase 2 — Snapshot-Cache am Handgerät ✅
- Letzter Hub-Snapshot persistent (`PosHandheldSnapshotCache`: Floor + Menü).
- Offline: offene Tische aus Cache bedienen; freie Tische ausgegraut; Speisekarte aus Cache.
- Kein neues `open session` offline (`canOpenNewTableSession` / Walk-in gesperrt).
- Bestellen/Kassieren ohne Hub weiter gesperrt (Outbox = Phase 3).

### Phase 3 — Handheld-Outbox → Hub-Flush ✅
- Durable Outbox (`PosHandheldOutbox`): Orders mit `eventId` / `clientLineId`.
- Auto-Flush nach Reconnect + manueller Retry (Mehr / Gerät).
- Hub: additiv mergen; `session_gone` / Duplikat-Events; Hard-Reject → Snapshot neu.
- UX: Badge „Nicht synchronisiert (n)“; ab ~45 Min verstärkter Banner.

### Phase 4 — Ops-Gates ✅
- Ohne Hub: Kassieren + neue Session + Resa-Schreiben gesperrt; Resa-UI read-only aus Cache.
- Mit Hub: Kassieren über `/v1/collect` (Fehler klar an UI); Resa schreiben über Hub.

### Phase 5 — Hub → Cloud / Fiskaly ✅
- iPad-`PosSyncQueue` gehärtet: Hub `/v1/collect` → Queue; Offline-Collect immer enqueue; FIFO-Stop; Nest Line-Mapping; Flush on reconnect; `markReceiptSynced`.
- Echte TSE später; Vermerk-Pfad (2b) bleibt geparkt.

### Phase 6 — UX Lightspeed-nah ✅
- Badge „Nicht synchronisiert (n)“ (Capsule + Mehr-Tab); tippbar → Flush / Reconnect.
- Konflikt-Sheet bei hartem Flush-Reject (`OutboxConflictSheet`).
- Stabile Bonjour-Reconnect-UX (`reconnectToHub`, Auto-Retry ~45s, Suche-Banner).

---

## Bewusst später / out of scope v1

- TSE-Offline-Vermerk (2b)
- Neue Tische offline
- Mehrere Hubs (Bar + Saal)
- Cloud-Solo produktiv
- Reservierungen offline **schreiben** (v1 = read-only; Writes später nur wenn Bedarf)

---

## Weiterarbeiten

1. Diesen Plan als Spec lesen.
2. Mit **Phase 1** starten (Hub-Pflicht im Onboarding + Solo nur DEBUG).
3. Keine parallele Cloud-SoT am Handgerät im Produktivpfad einführen.

**Nicht** ohne ausdrückliche Nutzer-Anfrage: Live-Deploy, TSE-SDK, Multi-Hub.
