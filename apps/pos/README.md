# Gwada POS (Swift)

Native iPad-Kasse + iPhone-Handgeräte. **Getrennt** von `apps/staff` (Expo, Kollege).

| | |
|--|--|
| Bundle ID | `app.gwada.pos` |
| Stack | SwiftUI, Network.framework, Bonjour (`NetService`) |
| Rolle | automatisch: iPad → Hub/Server, iPhone → Handgerät |
| LAN | Hub `http://<ip>:8787` · `_gwada-pos._tcp` |

## Öffnen (Mac)

```bash
brew install xcodegen   # einmalig
cd apps/pos
xcodegen generate
open GwadaPOS.xcodeproj
```

In Xcode: Team wählen, auf **iPad** und **iPhone** (gleiches WLAN) installieren.

## Test Phase 1

1. App auf dem **iPad** starten → Server Port 8787 + Bonjour  
2. App auf dem **iPhone** starten → findet Kasse, zeigt Demo-Tische  
3. Optional: Hub-IP manuell im Handgerät eintragen  

Demo-Snapshot ist lokal — Cloud-Login/Floor-API als Nächstes.

## Abgrenzung

- `apps/web` — APIs / Dashboard  
- `apps/staff` — Mitarbeiter-App (Expo), unberührt  
- `apps/pos` — diese native Kasse  
