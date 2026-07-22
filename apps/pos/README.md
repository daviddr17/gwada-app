# Gwada POS (Swift)

Native iPad-Kasse + iPhone-Handgeräte. **Getrennt** von `apps/staff` (Expo, soft-freeze).

**Zielbild Kellner-App (Prototyp v3):**  
[`docs/plans/kellner-swift-native-plan.md`](../../docs/plans/kellner-swift-native-plan.md) ·  
Event-Protokoll: [`docs/plans/kellner-event-protocol.md`](../../docs/plans/kellner-event-protocol.md) ·  
Cloud-API (Nest, Phase 0+): [`apps/pos-api`](../pos-api)

Diese App ist die **Swift-Homebase** (kein paralleles `ios/`-Verzeichnis). UX wird schrittweise an den Prototyp angeglichen; Bonjour-Service bleibt `_gwada-pos._tcp`.

| | |
|--|--|
| Bundle ID | `app.gwada.pos` |
| Stack | SwiftUI, Network.framework, Bonjour (`NetService`) |
| Rolle | automatisch: iPad → Hub/Server, iPhone → Handgerät |
| LAN | Hub `http://<ip>:8787` · `_gwada-pos._tcp` |

## Betriebsmodell

1. **iPad** meldet sich an (Cloud), lädt Bootstrap (Floor + Speisekarte + Register) → speichert lokal.
2. Danach läuft die Kasse **lokal**; Handgeräte holen Snapshot / Sessions / Orders nur über WLAN.
3. Ohne Internet: Service weiter (LAN). Sync-Queue auf dem iPad → DB + Fiskaly, sobald wieder online.
4. **Offline-Sessions:** Lokale Tisch-Session-IDs werden beim Sync auf Cloud-IDs gemappt; wartende Orders/Kassierungen werden umgeschrieben (`session-id-map.json`).
5. **Sync-Ziel (Phase 3):** Wenn in den Geräteeinstellungen eine **Nest API-Basis** gesetzt ist (`apps/pos-api`, z. B. `http://127.0.0.1:3100`), flushed die Outbox idempotent nach `POST /v1/sync/events` (`session.opened`, `order.created`, `payment.completed`, …). Ohne Nest-URL bleibt der bisherige Next-Pfad `/api/pos/*`.
6. **Gerät-ID** ist stabil (`PosDeviceIdentity` → Header `X-Device-Id`). Waiter-Caps landen im Snapshot (`waiterCaps`) ohne Klartext-PINs.
7. **Web** (`/dashboard/pos`): Verwaltung, Bestellungen, Statistiken, TSE.

## Öffnen (Mac)

```bash
brew install xcodegen   # einmalig
cd apps/pos
xcodegen generate
open GwadaPOS.xcodeproj
```

In Xcode: Team wählen, auf **iPad** und **iPhone** (gleiches WLAN) installieren.

### Erste Anmeldung (Kasse)

Im Login-Bereich setzen:

- E-Mail / Passwort (Restaurant-Mitarbeiter)
- Restaurant-ID (UUID)
- Erweitert: API-Basis Next (`https://gwada.app` oder Dev), **Nest API-Basis** (optional, Phase-3-Outbox), Waiter Profile-ID, Supabase-URL, Anon Key

### Nest Outbox (lokal)

```bash
# Terminal: pos-api
export POS_AUTH_RELAXED=1 POS_SKIP_REGISTER_CHECK=1
export SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=…
pnpm --filter @gwada/pos-api start:dev
# → http://127.0.0.1:3100
```

Auf dem iPad unter **Gerät → Erweitert / Nest Sync**: Nest-URL `http://<Mac-LAN-IP>:3100` eintragen. Curl-Referenz: [`docs/plans/kellner-pos-api-phase2-curl.md`](../../docs/plans/kellner-pos-api-phase2-curl.md).

## Test

1. App auf dem **iPad** starten → Server Port 8787 + Bonjour  
2. Anmelden → Cloud-Bootstrap (oder Cache/Demo ohne Netz)  
3. App auf dem **iPhone** starten → findet Kasse, zeigt Tische  
4. Ohne Internet: Handgerät ↔ iPad weiter nutzbar; Sync später  

## Abgrenzung

- `apps/web` — APIs / Dashboard / POS-Modul  
- `apps/staff` — Mitarbeiter-App (Expo), unberührt  
- `apps/pos` — diese native Kasse

## Design

- **Gwada-Akzent** `#EAB308` als `AccentColor` (Asset) + Tenant-Override via Bootstrap `brandAccentHex`
- Primär-CTAs: weicher Brand-Tint (wie Web `brand-action-button`), nicht solid blau/weiß
- Surfaces: System Grouped / Material — native Light/Dark
- Tokens: `PosDesign` (Status-Farben, Spacing, Timer-Label)
- Native iOS: Large Title, `.searchable`, `ContentUnavailableView`, Sheets/Detents, `.sensoryFeedback`, Swipe Actions

## Kellner-UI (Phase 4)

| Gerät | Chrome |
|---|---|
| **iPhone** | `TabView`: **Tische · Reservierungen · Mehr** + PIN-Lock |
| **iPad** | `NavigationSplitView` (Kasse) + optional PIN sperren |

Features: Floor-Grid (Timer/Summe/Res-Hinweis), Walk-in, Resv-Timeline 17–23, Session-Umzug, Übergabe (Nest), Gleich-teilen, Karte/PayPal via Nest, Gastbeleg-ShareLink, Caps-gefiltertes Mehr-Menü. Nest-Fallback-Flag für Hub-Ausfall.

## Härtung (Phase 5)

- PIN-Hash im **Keychain**; Lockout eskaliert; Auto-Lock + Background-Lock
- **Audit-Log** (Mehr → Audit, Share/Export)
- **Zahlung nur online** (Offline-Banner); Bestellen/LAN weiter offline
- **Fire** + **Freigeben** / Abbruch nur vor erstem Fire
- Pilot: [`docs/plans/kellner-phase5-pilot-checklist.md`](../../docs/plans/kellner-phase5-pilot-checklist.md)
- Expo-Entfernung (nach Signoff): [`docs/plans/expo-staff-removal-prep.md`](../../docs/plans/expo-staff-removal-prep.md)

## Küchen-Routing

Web **POS → Einstellungen**: Bondrucker anlegen, pro Speisekarten-Kategorie Ziel wählen (KDS / Drucker / beides / keines). Bootstrap liefert `kitchen` an den Hub; Bestellungen füllen KDS-Tickets und die lokale Druck-Queue (`/v1/print-jobs`). ESC/POS-Hardware folgt.

## Quittungen & Bar

- Sidebar **Quittungen**: heutige Zahlungen, Bar-Storno, Tisch wieder öffnen
- Beim Kassieren: Trinkgeld (% oder €), gegebenes Bargeld per Ziffernblock, automatisches Rückgeld

## Reservierungen

- Sidebar / Tab **Reservierungen**: Schedule-Ansicht mit **Wochenstreifen**, Monatswähler und **vertikaler Tages-Timeline** (Standard 17–23 Uhr, erweitert sich bei früheren/späteren Terminen)
- Karten nach Start/Ende positioniert (Höhe = Dauer); Überlappungen in Spuren; Tippen öffnet Notizen
- FAB **+** für neue Reservierung; Menü (⋯): Aktualisieren / Heute; Walk-in über Toolbar
- **Start:** heutiger Tag wird auf die Kasse geladen und lokal gecacht (offline)
- **Aktualisieren:** lädt den gewählten Tag neu (Kasse → Cloud; Handheld → Kasse)
- **Anlegen:** Handheld → Kasse (LAN) → Sync-Queue → DB; an der Kasse direkt Cloud/DB (sonst Queue)

