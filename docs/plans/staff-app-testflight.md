# Gwada Staff — TestFlight (LAN + Live)

> **Branch:** `feat/staff-ios-testflight` → `main`  
> **Bundle ID:** `app.gwada.staff`  
> **EAS-Projekt:** [@atfadi17/gwada-staff](https://expo.dev/accounts/atfadi17/projects/gwada-staff)  
> **Konfiguration:** [`apps/staff/eas.json`](../../apps/staff/eas.json), [`apps/staff/app.config.ts`](../../apps/staff/app.config.ts)

## Zwei Build-Profile

| Profil | Zweck | API / Supabase | ATS (HTTP) |
|--------|-------|----------------|------------|
| `preview-lan` | iPhone im **gleichen WLAN** wie dein Mac | `http://<Mac-LAN-IP>:54321` + `:3000` | `NSAllowsLocalNetworking` |
| `production` | Live / Teampartner überall | `https://new.gwada.app` + Live-Supabase | HTTPS, kein Extra |

URLs werden beim **EAS Build** eingebakken (`staff-env.generated.ts`) — nicht zur Laufzeit umschaltbar.

---

## Voraussetzungen (einmalig)

### Apple

| Punkt | Aktion |
|-------|--------|
| Apple Developer Program | aktiv |
| App ID | `app.gwada.staff` in [Apple Developer](https://developer.apple.com/account/resources/identifiers/list) |
| App Store Connect | App „Gwada Staff“ anlegen, Internal Testing-Gruppe |

### Expo / EAS

```bash
pnpm dlx eas-cli login    # bereits: atfadi17
cd apps/staff
pnpm dlx eas-cli init --non-interactive --force   # einmalig, projectId in app.config.ts
```

---

## LAN-Profil (`preview-lan`) — lokale DB im WLAN

### 1. Mac-Stack starten

```bash
pnpm db:start
pnpm db:push:local
pnpm dev                    # Network-URL z. B. http://192.168.x.x:3000
```

Mac-Firewall: eingehende Verbindungen für **3000** und **54321** erlauben.

### 2. Staff-`.env` mit LAN-IP erzeugen

```bash
pnpm staff:env:lan
```

Schreibt `apps/staff/.env` (gitignored) mit LAN-IP statt `127.0.0.1`.

### 3. EAS Environment `preview` befüllen

```bash
pnpm staff:eas-env:preview-lan
```

Überträgt die drei `EXPO_PUBLIC_*`-Variablen nach Expo (Environment **preview**).

### 4. iOS-Build + TestFlight

**Erstes Mal:** interaktiv (Apple-Anmeldung, Zertifikate, App Store Connect-App):

```bash
cd apps/staff
pnpm dlx eas-cli credentials --platform ios   # Profil preview-lan wählen
pnpm staff:build:ios:preview-lan               # folgt Prompts
pnpm staff:submit:ios:preview-lan
```

Folge-Builds: gleiche Befehle; `ios.buildNumber` vor jedem Upload erhöhen.

Oder manuell in [expo.dev](https://expo.dev) → Builds → Submit.

**Vor jedem neuen Upload:** `ios.buildNumber` in [`app.config.ts`](../../apps/staff/app.config.ts) erhöhen.

### 5. Auf dem iPhone testen

- TestFlight-App installieren
- Gleiches WLAN wie der Mac
- Mac: `pnpm db:start` + `pnpm dev` laufen lassen
- Login z. B. `demo@gwada.app` — siehe [E2E-Protokoll](./staff-app-e2e-test-protocol.md)

**LAN-IP geändert (DHCP)?** → `pnpm staff:env:lan`, `pnpm staff:eas-env:preview-lan`, neu bauen.

---

## Live-Profil (`production`)

### EAS Environment `production` setzen (Secrets nicht ins Git)

```bash
cd apps/staff
pnpm dlx eas-cli env:create production --name EXPO_PUBLIC_GWADA_API_URL \
  --value "https://new.gwada.app" --type string --visibility plaintext --force --non-interactive

pnpm dlx eas-cli env:create production --name EXPO_PUBLIC_SUPABASE_URL \
  --value "https://<live-supabase-host>" --type string --visibility sensitive --force --non-interactive

pnpm dlx eas-cli env:create production --name EXPO_PUBLIC_SUPABASE_ANON_KEY \
  --value "<live-publishable-key>" --type string --visibility sensitive --force --non-interactive
```

Build + Submit:

```bash
pnpm staff:build:ios:production
pnpm staff:submit:ios:production
```

**Hinweis:** Live-DB-Migrationen und App-Deploy sind separat (`deploy-live-db.yml`, Push auf `main`). Fiskaly LIVE nur bewusst aktivieren.

---

## Lokaler Simulator (ohne TestFlight)

```bash
pnpm run dev:staff:ios
# .env mit 127.0.0.1 — cp apps/staff/.env.example apps/staff/.env + Keys aus supabase status
```

---

## Checkliste vor erstem TestFlight-Upload

- [ ] E2E-Protokoll [`staff-app-e2e-test-protocol.md`](./staff-app-e2e-test-protocol.md) (Simulator)
- [ ] App-Icon / Splash ([`apps/staff/assets/images/`](../../apps/staff/assets/images/))
- [ ] Apple App ID `app.gwada.staff`
- [ ] `preview-lan`: EAS preview-Env mit LAN-IP (nicht localhost)
- [ ] `production`: Live-URLs in EAS production-Env
- [ ] `buildNumber` erhöht

## Scripts (Root)

| Script | Beschreibung |
|--------|--------------|
| `pnpm staff:env:lan` | LAN-`.env` + `staff-env.generated.ts` |
| `pnpm staff:eas-env:preview-lan` | `.env` → EAS preview |
| `pnpm staff:build:ios:preview-lan` | EAS iOS-Build LAN |
| `pnpm staff:build:ios:production` | EAS iOS-Build Live |
| `pnpm staff:submit:ios:preview-lan` | TestFlight-Upload (letzter Build) |
| `pnpm staff:submit:ios:production` | App Store Connect (Live) |
