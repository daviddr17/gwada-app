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
│  SwiftUI + NWListener :8787 │         (wenn Internet verfügbar)
│  Bonjour _gwada-pos._tcp    │
│  lokaler Store + Sync-Queue │
└──────────────▲──────────────┘
               │ lokales WLAN (kein Internet nötig)
┌──────────────┴──────────────┐
│  iPhone — Rolle: handheld   │
│  Nur startbar, wenn Hub da  │
│  Snapshot / Bestellungen    │
│  über Kassen-iPad           │
└─────────────────────────────┘
```

Dieselbe Binary: `UIDevice.current.userInterfaceIdiom == .pad` → Hub, sonst Handgerät.

### Betriebsmodell (verbindlich)

| Schicht | Verhalten |
|--------|-----------|
| **iPad-Kasse** | Beim Start mit Internet: Daten aus der DB laden (Speisekarte, Tische, Config). Danach lokal arbeiten. |
| **Handgeräte** | Kommunizieren nur mit dem Kassen-iPad (lokales WLAN). Start nur, wenn die Kasse erreichbar ist; Snapshot beim Start vom Hub. |
| **Ohne Internet** | Service läuft weiter (Handgerät ↔ iPad lokal). Kein frischer Cloud-Pull, kein Sofort-Sync zu DB/Fiskaly. |
| **Sync** | Sobald Internet wieder da: iPad schiebt lokale Queue → DB + Fiskaly. |
| **Web-App (`/dashboard/pos`)** | Verwaltung & Überblick (Bestellungen, Statistiken, TSE/Einstellungen) — nicht die Tischbedienung. |

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

### Speisekarte → POS (Web)

- [x] Optionsgruppen (Beilagen/Extras) mit Positionen + optionalem Aufpreis
- [x] Chip „Optionen“ + Zuordnung am Gericht
- [ ] POS liest Optionsgruppen und lässt Choices wählen

### Phase 2 — Bestell-Flow nativ

- [ ] Tische, Warenkorb, Optionen wählen, senden über Hub
- [ ] Barzahlung / Beleg über Web-API vom Hub

### Phase 3 — Offline-Queue / Hardware

- [ ] Persistente Sync-Queue auf dem iPad (Bestellungen, Zahlungen, Fiskal) → DB + Fiskaly bei Verbindung
- [ ] Handgerät: kein Neustart ohne Hub; laufender Snapshot bei kurzem WLAN-Wackler tolerant
- [ ] Bondrucker, Schublade
