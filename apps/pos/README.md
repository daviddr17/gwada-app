# Gwada POS (Swift)

Native iPad-Kasse + iPhone-Handgeräte. **Getrennt** von `apps/staff` (Expo, Kollege).

| | |
|--|--|
| Bundle ID | `app.gwada.pos` |
| Stack | SwiftUI, Network.framework, Bonjour (`NetService`) |
| Rolle | automatisch: iPad → Hub/Server, iPhone → Handgerät |
| LAN | Hub `http://<ip>:8787` · `_gwada-pos._tcp` |

## Betriebsmodell

1. **Dashboard** (Recht `pos.kasse.manage`): unter POS → Einstellungen → Geräte ein Gerät anlegen und **Kopplungscode** erzeugen.
2. **iPad / iPhone** einmalig mit dem Code koppeln → Restaurant ist gebunden.
3. Mitarbeiter melden sich nur noch mit der **Display-PIN** an (Recht `pos.kasse.use` oder `pos.kasse.manage`).
4. **Online:** PIN live gegen Cloud; Auth-Roster (Offline-Hashes) wird lokal gecacht.
5. **Offline (nach Kopplung):** PIN gegen den letzten lokalen Roster; Kasse läuft lokal/LAN; bei Netz wieder → Session-Resume + Sync-Queue.
6. **Pro Gerät eigene PIN-Session** (Kasse ≠ Handgerät). Handgerät spricht nur die Kasse (LAN + Shared Secret); die Kasse synct allein zur Cloud.
7. **KDS/Drucker** lokal an der Kasse; Handgerät holt KDS über WLAN von der Kasse.
8. **iPad** lädt Bootstrap (Floor + Speisekarte + Register) → speichert lokal.
9. Ohne Internet: Service weiter (LAN). Sync-Queue auf dem iPad → DB + Fiskaly, sobald wieder online.
10. **Offline-Sessions:** Lokale Tisch-Session-IDs werden beim Sync auf Cloud-IDs gemappt.
11. **Web** (`/dashboard/pos`): Verwaltung, Bestellungen, Statistiken, TSE, Geräte-Kopplung.

Hinweis Offline-PIN: Nach App-/DB-Update einmal online PIN setzen oder an der Kasse einloggen (füllt den lokalen Roster). Danach funktioniert PIN auch ohne Netz.

## Öffnen (Mac)

```bash
brew install xcodegen   # einmalig
cd apps/pos
xcodegen generate
open GwadaPOS.xcodeproj
```

In Xcode: Team wählen, auf **iPad** und **iPhone** (gleiches WLAN) installieren.

### Erste Anmeldung (Kasse / Handheld)

1. Im Web-Dashboard: **POS → Einstellungen → Geräte** → Gerät anlegen → Kopplungscode  
2. In der App: Code eingeben → Gerät koppeln  
3. Display-PIN des Mitarbeiters (mit Recht „Kasse bedienen“)  
4. Erweitert (nur bei Bedarf): API-Basis (`https://gwada.app` oder Dev)

## Test

1. Gerät im Dashboard anlegen, Code erzeugen  
2. App auf dem **iPad** starten → koppeln → PIN → Server Port 8787 + Bonjour  
3. App auf dem **iPhone** starten → ebenfalls koppeln + PIN → findet Kasse, zeigt Tische  
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

