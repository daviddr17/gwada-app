# Gwada Staff — Security Review (internes TestFlight)

> **Stand:** 2026-06-10  
> **Scope:** `apps/staff` + `/api/pos/*`  
> **Rollout-Ziel:** internes TestFlight (kein öffentlicher App Store)

## Ampel-Übersicht

| Thema | Status | Maßnahme |
|-------|--------|----------|
| Kein Service-Role im Client | Grün | Nur Anon-Key + User-JWT |
| Auth-Session in SecureStore | Grün | [`apps/staff/src/lib/supabase.ts`](../../apps/staff/src/lib/supabase.ts) |
| POS-API Staff-Auth | Grün | [`authorizePosRestaurant`](../../apps/web/lib/pos/pos-route-auth.ts) auf allen POS-Routes |
| RLS auf POS-Tabellen | Grün | `auth_is_restaurant_staff` |
| Keine Drittanbieter-Secrets in Bundle | Grün | Nur `EXPO_PUBLIC_*` (Supabase URL/Anon, API-Base) |
| LAN-Override nur preview-lan | Grün | [`isLanPreviewBuild()`](../../apps/staff/src/lib/staff-build-profile.ts) |
| Geteilte Kellner-Geräte | Grün | PIN-Lock (4 Ziffern, serverseitig gehasht) + 15-Min-Timeout |
| PDF/ZIP Share-Sheets | Gelb | Bewusstes Feature; Nutzer teilt bewusst |
| Mollie-Keys serverseitig | Grün | Kein Mollie-Secret im Client |
| Certificate Pinning | Gelb | Nicht implementiert (Standard HTTPS) |
| Jailbreak/Root-Erkennung | Gelb | Nicht implementiert (internes TestFlight) |

## Client (`apps/staff`)

### Secrets und Konfiguration

- **Erlaubt im Bundle:** `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_GWADA_API_URL` (via `staff-env.generated.ts` / EAS env).
- **Verboten:** Fiskaly, Mollie, Service-Role, SMTP, Integrations-API-Keys.
- **Production-Build:** Feste HTTPS-URLs (`https://new.gwada.app`, Live-Supabase). Kein `NSAllowsLocalNetworking`.
- **preview-lan:** `LanBackendSection` nur wenn `staffBuildProfile === "preview-lan"`.

### Authentifizierung

- Supabase Auth (E-Mail/Passwort).
- Session-Tokens in **expo-secure-store** (nicht AsyncStorage).
- POS-Mutationen ausschließlich über `/api/pos/*` mit `Authorization: Bearer <access_token>`.
- Direkte Supabase-Reads: Menu, Dining Floor, Reservierungen — durch RLS geschützt.

### App-Sperre

- **PIN-Lock:** 4 Ziffern, serverseitig gehasht (`profiles.staff_app_pin_hash`, RPCs `set_staff_app_pin`, `verify_staff_app_pin`).
- **Session-Timeout:** 15 Minuten Inaktivität (`useStaffInactivityTimeout`) → PIN erneut, keine Datenverluste bei offener Session.
- **5 Fehlversuche:** Abmelden (`signOutOnLockout`).

## Server (`apps/web/app/api/pos`)

- Jede Route: `authorizePosRestaurant` oder `authorizePosRestaurantPermission`.
- Bearer-JWT aus Staff-App; Cookie-Fallback nur für Web-Browser.
- Fiskaly/Mollie/Receipt-Generierung nur serverseitig.
- Webhook `/api/pos/mollie/webhook`: Signaturprüfung via `webhook_secret` (Platform).

## Bekannte Restrisiken (akzeptiert für internes TestFlight)

| Risiko | Mitigation |
|--------|------------|
| Gestohlenes iPhone mit gültiger Session | PIN + Timeout; Nutzer soll Gerät sperren |
| Anon-Key im Bundle extrahierbar | RLS; nur Daten des angemeldeten Staff |
| Kein Cert-Pinning | HTTPS + Apple ATS in Production |
| Share-Sheet für Belege/DSFinV-K | Schulung: nur an Kunden/Fiskaly-Berater |

## Automatisierte Vorprüfung

```bash
pnpm --filter staff exec tsc --noEmit
node scripts/test-fiskaly-provision-unit.mjs   # optional POS-bezogen
node scripts/test-dsfinvk-runtime-export.mjs   # wenn lokal
```

## Sign-off

| Rolle | Datum | Status |
|-------|-------|--------|
| Entwicklung | | |
| Produkt / Betrieb | | |
