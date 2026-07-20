# Kellner / Hub — Phase-5 Pilot-Checklist

Stand: 2026-07-20 · Bezug: [`kellner-swift-native-plan.md`](./kellner-swift-native-plan.md)

**Exit Phase 5:** Ein Standort Pilot-Schicht; diese Checklist signiert.

## Vor TestFlight

- [ ] `cd apps/pos && xcodegen generate` — Build iPhone + iPad Release
- [ ] Team / Bundle `app.gwada.pos` / Signing
- [ ] Nest `apps/pos-api` erreichbar (Staging) + Migrationen lokal/Live nach Absprache
- [ ] PIN im Keychain (Setup auf Gerät), Auto-Lock ~120s, Background-Lock
- [ ] Hub Bonjour `_gwada-pos._tcp` :8787 im Standort-WLAN

## Offline-/Online-Matrix

| Aktion | Offline | Online |
|---|---|---|
| Tisch öffnen / Bestellen / Fire (LAN Hub) | ✅ | ✅ |
| Reservierung lesen (Cache) | ✅ | ✅ |
| Bar / Karte / PayPal / Gutschein | ❌ Banner + Gate | ✅ |
| Sync-Outbox Flush | wartet | Nest oder Next |
| Tisch freigeben / Abbruch vor Fire | ✅ lokal + Queue | ✅ |

## Schicht-Walkthrough (Pilot)

1. PIN entsperren → Tabs Tische / Resv / Mehr  
2. Walk-in → Order → **Fire** → Küche/KDS prüfen  
3. Split Bar (online) → Gastbeleg teilen  
4. Offener Betrag 0 → **Freigeben**  
5. Abbruch-Versuch nach Fire → muss blockieren  
6. Airplane Mode → Zahlung gesperrt, Bestellen weiter  
7. Übergabe (Nest) + Audit-Log exportieren  
8. App in Hintergrund → PIN-Lock  

## Signoff

| Rolle | Name | Datum | OK |
|---|---|---|---|
| Standort-Leitung | | | ☐ |
| Tech / Gwada | | | ☐ |

Nach Signoff: Expo-Entfernung gemäß [`expo-staff-removal-prep.md`](./expo-staff-removal-prep.md).
