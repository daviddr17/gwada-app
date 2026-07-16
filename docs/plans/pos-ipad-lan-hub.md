# Gwada POS (Swift) — iPad-Kasse + iPhone-Handgeräte

> **Branch:** `cursor/ipad-kasse-lan-hub-0c8e`  
> **App:** `apps/pos` — **native SwiftUI**, Bundle `app.gwada.pos`  
> **Staff (`apps/staff`):** bleibt die App des Kollegen — **nicht** für POS erweitern

---

## Apps im Monorepo

| App | Pfad | Stack | Verantwortung |
|-----|------|-------|----------------|
| Web | `apps/web` | Next.js | Dashboard, APIs, Fiskaly, Sync |
| Staff | `apps/staff` | Expo (Kollege) | Schicht, Reservierungen, … |
| **POS** | `apps/pos` | **Swift / SwiftUI** | iPad-Kasse, Handgeräte, lokales WLAN |

---

## Architektur

```text
┌─────────────────────────────┐         Cloud (gwada.app / Supabase)
│  iPad — Rolle: hub (auto)   │◄─────── Auth, Speisekarte, TSE, Sync
│  SwiftUI + NWListener :8787 │
│  Bonjour _gwada-pos._tcp    │
└──────────────▲──────────────┘
               │ lokales WLAN
┌──────────────┴──────────────┐
│  iPhone — Rolle: handheld   │
│  Beim Start: Hub finden     │
│  Snapshot von der Kasse     │
└─────────────────────────────┘
```

Dieselbe Binary: `UIDevice.current.userInterfaceIdiom == .pad` → Hub, sonst Handgerät.

---

## Lokal öffnen (Mac)

```bash
# XcodeGen (einmalig): brew install xcodegen
cd apps/pos
xcodegen generate
open GwadaPOS.xcodeproj
```

Team / Signing in Xcode setzen (`26N959J5Q3` oder euer Team).  
Simulator oder Gerät: iPad = Server, iPhone = Client (gleiches WLAN / Simulator-Netz beachten).

---

## Phasen

### Phase 1 — Grundlage ← **aktuell**

- [x] Staff von POS-Änderungen freigehalten
- [x] Swift-App-Scaffold `apps/pos`
- [x] Auto-Rolle iPad/iPhone
- [x] Hub-HTTP (`/v1/health`, `/v1/snapshot`) + Bonjour
- [x] Handgerät: Discovery + Snapshot-Abruf
- [ ] Cloud-Login / echte Floor-Daten (statt Demo-Snapshot)
- [ ] TestFlight Bundle `app.gwada.pos` (eigene App, getrennt von Staff)

### Phase 2 — Bestell-Flow nativ

- [ ] Tische, Warenkorb, senden über Hub
- [ ] Barzahlung / Beleg über Web-API vom Hub

### Phase 3 — Offline / Hardware

- [ ] Queue, Bondrucker, Schublade
