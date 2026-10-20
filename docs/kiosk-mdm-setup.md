# Kiosk-Geräte: MDM / Single App / Lock Task

Ziel: Gast-Shell (`/kiosk/…`) dauerhaft auf dem Gerät halten — **nicht** die Marketing-Website.

| Gerät | Kanal | Start-URL | Lock |
|-------|-------|-----------|------|
| iPad am Tisch | `table` | `/kiosk/{slug}/table/{tableId}` | iPadOS Single App Mode / Guided Access / MDM |
| Counter (Sunmi, PAX, Elo, …) | `kiosk` | `/kiosk/{slug}` | Android Lock Task / Dedicated Device / Kiosk-Launcher |

Staff-Exit in der App: 5× „Gwada Kiosk“ tippen → Mitarbeiter-Display-PIN. Danach Gerät-Lock manuell beenden.

## iPad — Single App Mode

1. PWA / Safari mit Start-URL; Manifest: `/kiosk/manifest.webmanifest?slug=…`
2. MDM Single App Mode auf Safari oder Web-Clip
3. Ohne MDM: Guided Access

Beispiel (Apple Configurator / MDM, illustrativ):

```xml
<key>PayloadType</key>
<string>com.apple.app.lock</string>
<key>App</key>
<dict>
  <key>Identifier</key>
  <string>com.apple.mobilesafari</string>
</dict>
```

## Android Counter — Lock Task

1. Dedicated Device (Android Enterprise)
2. Kiosk-Browser / Hersteller-Launcher mit Autostart-URL `/kiosk/{slug}`
3. Mollie-Terminal-ID in POS → Online & Kiosk (`term_…`)

```json
{
  "lockTaskAllowed": true,
  "kioskUrl": "https://gwada.app/kiosk/MEIN-SLUG",
  "stayAwake": true
}
```

## Checkliste

- Mollie Connect aktiv; Kiosk/Online an
- Counter: Terminal-ID gesetzt
- Display-PINs für Exit
- Gerät-Lock getestet; Idle-Reset ok

Kein volles MDM-Console in Gwada — URL + App-Lockdown + Vorlagen.
