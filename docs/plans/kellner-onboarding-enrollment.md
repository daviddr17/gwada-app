# Kellner Onboarding & Enrollment (Dev-VPS first)

Stand: abgestimmt 2026-07-24. Ergänzt [`kellner-swift-native-plan.md`](./kellner-swift-native-plan.md).

## Zielbild (Kunde)

1. App aus Store / TestFlight laden (eine App, iPad + iPhone).
2. **iPad** per Wizard initialisieren → Hub/Kasse, Cloud = **Dev-VPS**.
3. **iPhone** pro Gerät freigeben (QR/Code) → Kellner-PIN → loslegen.
4. Keine Restaurant-UUID, Anon-Keys, Nest-/Supabase-URLs tippen.

## Entscheidungen

| # | Entscheidung |
|---|---|
| 1 | Zuerst nur **Dev-VPS**; Live später |
| 2 | iPad-Zugang: **E-Mail/Passwort** und **Einrichtungs-Code aus Web** |
| 3 | iPhone: **Kasse gekoppelt + Kellner-PIN** (PIN → Name auf Quittung) |
| 4 | Pairing: **einzelne Freigabe pro Gerät** |
| 5 | Ohne Hub: **blockierender Screen** („Kasse einschalten“); kein Kunden-Solo. Kurz offline nach Pairing: Cache + Banner. Debug-Solo nur `#if DEBUG` |
| 6 | Wizard: **Gwada + Tenant** Name/Logo/Akzent nach Login |
| 7 | Priorität: **Onboarding + Dev-Defaults** vor weiterem Feature-Feinschliff |

## Betriebsmodell

```
Web-Admin (Dev)          Dev-VPS Supabase (:8100) + Next/Nest (Dev)
        │ setup-code / staff login              ▲
        ▼                                       │ bootstrap / sync
   iPad Hub ── Bonjour/LAN :8787 ── iPhone(s) ──┘ (Daten primär vom Hub)
        │ approve pairing
        └── QR / Kurzcode pro Gerät
```

## Wizard-Flows

### iPad — „Kasse einrichten“

1. Willkommen  
2. Zugang: Login **oder** Setup-Code  
3. Standort wählen (Klarnamen)  
4. Branding laden  
5. Geräte-PIN (Sperre)  
6. Fertig → Hub läuft + Screen „Handgeräte verbinden“ (QR, ausstehende Freigaben)

### iPhone — „Handgerät“

1. Willkommen  
2. Bonjour-Suche / QR / Code  
3. Warten auf Freigabe am iPad  
4. Kellner-PIN  
5. Tabs Tische · Reservierungen · Mehr  

Ohne Freigabe/Hub: Block-Screen, kein Demo-Floor.

## Backend (Minimal)

- Enrollment-Session (Login oder Setup-Code) → Device-Token + restaurantId + Endpoints  
- Pairing-Challenge (Hub) / Claim (iPhone) / Approve (Hub)  
- Web: POS → Geräte (Setup-Code, Geräteliste, Widerruf)  
- Waiter-PIN → Profilname für Quittung (bestehende Caps/PIN-Caches)

## App-Defaults (Dev-Build)

| Key | Quelle |
|---|---|
| Supabase URL | `PosEnvironment.dev` → VPS Kong `:8100` |
| Anon Key | Bundle / Dev-Secrets (nicht UI) |
| API-Basis | Bundle `POSDevApiBaseURL` (Next gegen Dev-DB; Simulator oft `http://127.0.0.1:3000`) |
| Live-Kanal | später `PosEnvironment.production` |

## Umsetzungsschritte

1. **Dev-Defaults + iPad-Login-Wizard** (Zugang Passwort, Standort, Bootstrap) — ✅  
2. **Setup-Code API + Claim + Wizard** — ✅ (`POST /api/pos/devices/enroll`, Device-Token-Auth für Bootstrap/Resv)  
3. Pairing QR/Code + Freigabe pro Gerät auf dem iPad  
4. iPhone-Wizard + PIN → Quittungsname  
5. Web Geräte-UI Feinschliff  
6. Polish Branding, Fehlertexte, Widerruf; Solo nur DEBUG  

## Akzeptanz

- [x] iPad-Wizard → Login-Pfad  
- [x] Setup-Code Claim → Device-Token → Bootstrap ohne User-Bearer  
- [ ] iPhone: QR → wartet → iPad genehmigt → Tabs  
- [ ] Zweites iPhone = eigene Freigabe  
- [ ] Abgelaufene Codes klar abgelehnt  
- [ ] Ohne Hub: Block-Screen, kein Demo  

## Nicht-Ziele (diese Phase)

- Live-Production-Kanal  
- Kunden-Solo / manuelle Cloud-URL-UI  
- Vollständige Nest-Enrollment-API falls Web-POS-Auth reicht für Schritt 1–2
