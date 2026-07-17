# Gwada POS (Swift)

Native iPad-Kasse + iPhone-Handgeräte. **Getrennt** von `apps/staff` (Expo, Kollege).

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
4. **Web** (`/dashboard/pos`): Verwaltung, Bestellungen, Statistiken, TSE.

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
- Erweitert: API-Basis (`https://gwada.app` oder Dev), Supabase-URL, Anon Key

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
- Native iOS: Large Title, `.searchable`, `ContentUnavailableView`, Sheets/Detents, `.sensoryFeedback`, Swipe Actions

## Küchen-Routing

Web **POS → Einstellungen**: Bondrucker anlegen, pro Speisekarten-Kategorie Ziel wählen (KDS / Drucker / beides / keines). Bootstrap liefert `kitchen` an den Hub; Bestellungen füllen KDS-Tickets und die lokale Druck-Queue (`/v1/print-jobs`). ESC/POS-Hardware folgt.

## Quittungen & Bar

- Sidebar **Quittungen**: heutige Zahlungen, Bar-Storno, Tisch wieder öffnen
- Beim Kassieren: Trinkgeld (% oder €), gegebenes Bargeld per Ziffernblock, automatisches Rückgeld

## Reservierungen

- Sidebar **Reservierungen** (iPad-Kasse + iPhone-Handheld): Tagesliste mit Datumspicker, neue Reservierung anlegen
- **Start:** heutiger Tag wird auf die Kasse geladen und lokal gecacht (offline)
- **Aktualisieren:** lädt den gewählten Tag neu (Kasse → Cloud; Handheld → Kasse)
- **Anlegen:** Handheld → Kasse (LAN) → Sync-Queue → DB; an der Kasse direkt Cloud/DB (sonst Queue)

