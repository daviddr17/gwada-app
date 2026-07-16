# iPad-Kasse: lokaler LAN-Hub + iPhone-Handgeräte

> **Branch:** `cursor/ipad-kasse-lan-hub-0c8e`  
> **Stand:** Phase 1 (Protokoll + Hub-Server + Start-Abruf) in Umsetzung  
> **Ziel:** iPad als Kasse mit Hintergrund-Server; iPhones als Handgeräte über lokales WLAN

---

## Architektur

```text
┌─────────────────────────────┐         Cloud (Supabase / Next API)
│  iPad — Rolle: hub          │◄─────── Fiskaly, Sync, Auth, Stammdaten
│  • Staff-UI (Kasse/Tische)  │
│  • HTTP-Server :8787 (WLAN) │
│  • Bonjour _gwada-pos._tcp  │
└──────────────▲──────────────┘
               │ lokales WLAN
               │ GET /v1/health, /v1/snapshot
               │ (später: Mutations)
┌──────────────┴──────────────┐
│  iPhone — Rolle: handheld   │
│  • Beim Start: Hub finden   │
│  • Snapshot von der Kasse   │
│  • Bestellen / Tische       │
└─────────────────────────────┘
```

| Gerät | Rolle | Aufgabe |
|-------|-------|---------|
| **iPad** | `hub` | Autoritative Schicht-Instanz im Lokalnetz; Server im Hintergrund; wirbt per Bonjour; sync’t mit Cloud |
| **iPhone** | `handheld` | Dünner Client; findet Hub; holt beim Start den Snapshot von der Kasse |

Kommunikation Handgerät ↔ Kasse läuft **über lokales WLAN**, nicht über die Cloud. Die Cloud bleibt für Login, Fiskaly/TSE, Stammdaten-Sync und Hub-Upstream.

---

## Start-Ablauf (Handgerät)

1. App startet → Rolle `handheld` (Default auf iPhone)
2. Letzte Hub-Adresse aus SecureStore **oder** Bonjour-Scan `_gwada-pos._tcp`
3. `GET /v1/health` → dann `GET /v1/snapshot`
4. Tische/Bestellungen aus Snapshot speisen; bei Verbindungsverlust Banner „Kasse nicht erreichbar“

## Start-Ablauf (Hub / iPad)

1. App startet → Rolle `hub` (Default auf iPad)
2. Nach Restaurant-Auswahl: TCP-HTTP-Server auf Port **8787**
3. Bonjour-Publish `Gwada Kasse` / `_gwada-pos._tcp`
4. Hub lädt Floor/Register wie bisher (Cloud) und liefert sie lokal aus

---

## Protokoll (`@gwada/pos-lan`)

| Konstante | Wert |
|-----------|------|
| Port | `8787` |
| Bonjour-Typ | `gwada-pos` → `_gwada-pos._tcp` |
| Health | `GET /v1/health` |
| Snapshot | `GET /v1/snapshot` |
| Header | `X-Gwada-Restaurant-Id`, `X-Gwada-Pos-Lan: 1` |

---

## Phasen

### Phase 1 — Grundlage ← **aktuell**

- [x] Architektur-Doc
- [x] `@gwada/pos-lan` (Protokoll, HTTP-Parse, Snapshot-Typen)
- [x] Device-Rolle (hub / handheld) + Persistenz
- [x] Hub-HTTP-Server (Hintergrund) + Bonjour-Publish
- [x] Handgerät: Discovery + Snapshot beim Start
- [x] Menü: Rolle, Hub-Status, manuelle Hub-IP

### Phase 2 — Mutations über Hub

- [ ] Handgerät sendet Orders/Payments an Hub-Endpunkte
- [ ] Hub proxied/serialisiert gegen Cloud-API + lokale Queue

### Phase 3 — Offline-Härte

- [ ] Hub-Queue wenn Cloud weg
- [ ] Konflikte / Idempotenz / Wiederaufnahme nach Neustart

---

## Native Voraussetzungen

- Development Build / TestFlight (kein Expo Go) — `expo-zeroconf`, `react-native-tcp-socket`
- iOS: `NSLocalNetworkUsageDescription`, `NSBonjourServices: ["_gwada-pos._tcp"]`, `NSAllowsLocalNetworking`
- Gleiches WLAN; Gast-WLAN mit Client-Isolation blockiert Discovery

---

## Abgrenzung

- **Nicht** verwechseln mit `preview-lan` / „Backend im WLAN“ (Mac-Dev-Stack).
- LAN-Hub = **Restaurant-Betrieb** (iPad-Kasse ↔ iPhones), nicht Dev-Metro.
