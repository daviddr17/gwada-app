# Gwada Staff — TestFlight (LAN + Live)

> **Branch:** `feat/staff-ios-testflight` → `main`  
> **Bundle ID:** `app.gwada.staff`  
> **EAS-Projekt:** [@atfadi17/gwada-staff](https://expo.dev/accounts/atfadi17/projects/gwada-staff)  
> **Konfiguration:** [`apps/staff/eas.json`](../../apps/staff/eas.json), [`apps/staff/app.config.ts`](../../apps/staff/app.config.ts)

## Zwei Build-Profile

| Profil | Zweck | API / Supabase | ATS (HTTP) |
|--------|-------|----------------|------------|
| `preview-lan` | iPhone im **gleichen WLAN** wie dein Mac | `http://<Mac-LAN-IP>:54321` + `:3000` | `NSAllowsLocalNetworking` |
| `production` | Live / Teampartner überall | `https://gwada.app` + Live-Supabase | HTTPS, kein Extra |

URLs landen in `staff-env.generated.ts` (beim **Build** oder **EAS Update**). Zusätzlich: **preview-lan** kann die Mac-IP **in der App** überschreiben (SecureStore) — schnellster Weg bei DHCP.

---

## Rollout: Neuer Build vs. EAS Update vs. Laufzeit-URL

| Änderung | Neuer TestFlight-Build? | EAS Update (OTA)? | In-App (geplant) |
|----------|-------------------------|-------------------|------------------|
| **JS/UI/Bugfix** (gleiche Native-Version) | Nein | Ja | — |
| **LAN-IP** (DHCP) | Nein* | Ja* | **Ja** (schnellste Option) |
| **Live-URL** in `production` | Nein* | Ja* | Nein (fest) |
| **Native Deps / SDK / ATS** | **Ja** | Nein | Nein |
| **Erstinstallation** auf iPhone | **Ja** (einmalig) | — | — |

\* Nach Einrichtung von **expo-updates** + Channel pro Profil (`preview-lan`, `production`).

### Zielbild Kellner-App

1. **TestFlight-Build** selten: erste Installation, Native-Änderungen, SDK-Upgrade.
2. **EAS Update** für tägliche JS-Releases und **URL-Änderungen** (nach `pnpm staff:eas-env:preview-lan` → `eas update --channel preview-lan`).
3. **`preview-lan` extra:** Einstellungen „Server im WLAN“ (IP/Host in SecureStore) — **kein** Build und **kein** OTA bei DHCP-Wechsel; nur Mac-Stack neu starten.

`production` bleibt auf festen HTTPS-URLs; OTA nur für App-Logik, nicht für Tenant-URL-Eingabe.

### Umgesetzt

- [x] `expo-updates` + `runtimeVersion` (`appVersion`) + Channel in `eas.json`
- [x] `pnpm staff:update:preview-lan` / `pnpm staff:update:production`
- [x] Login + Restaurant-Auswahl: **Backend im WLAN** (Mac-IP, SecureStore)

**Einmalig nach diesem Stand:** neuer TestFlight-Build (`buildNumber` 4+) — danach OTA + In-App-IP ohne erneutes TestFlight bei DHCP.

---

## OTA (EAS Update) — ohne neuen TestFlight-Build

### IP / JS geändert (preview-lan)

```bash
pnpm staff:env:lan                    # .env mit aktueller Mac-IP
pnpm staff:update:preview-lan         # → EAS preview-Env + OTA auf Channel preview-lan
```

App beim nächsten Start neu öffnen (lädt Update automatisch).

**Noch schneller bei DHCP:** Login → **Backend im WLAN** → neue IP speichern (kein OTA nötig).

### Live (production)

```bash
pnpm staff:update:production
# optional: STAFF_UPDATE_MESSAGE="Fix Tische" pnpm staff:update:production
```

### Wann doch neu bauen?

- Erstinstallation, `expo-updates`/SDK/Native-Deps, ATS-Änderungen
- `runtimeVersion` (= `version` in app.config) erhöht → neuer **Build** nötig, danach wieder OTA

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

**Build schlägt bei „Install dependencies“ / „Prebuild“ fehl?** `apps/web` bringt `sharp` ins Monorepo — der Postinstall scheitert auf EAS. Staff nutzt `.eas/build/ios-staff-monorepo.yml`: `scripts/eas-patch-monorepo-for-staff.mjs` schränkt `pnpm-workspace.yaml` auf Staff ein (auch für den zweiten Install in `eas/prebuild`), plus `.easignore` ohne `apps/web`.

Oder manuell in [expo.dev](https://expo.dev) → Builds → Submit.

**Vor jedem neuen Upload:** `ios.buildNumber` in [`app.config.ts`](../../apps/staff/app.config.ts) erhöhen.

### 5. Auf dem iPhone testen

- TestFlight-App installieren
- Gleiches WLAN wie der Mac
- Mac: `pnpm db:start` + `pnpm dev` laufen lassen
- Login z. B. `demo@gwada.app` — siehe [E2E-Protokoll](./staff-app-e2e-test-protocol.md)

**LAN-IP geändert (DHCP)?** → Login **Backend im WLAN** (sofort) **oder** `pnpm staff:env:lan` + `pnpm staff:update:preview-lan` (OTA). Kein TestFlight nötig (nach Build mit `expo-updates`).

---

## Live-Profil (`production`)

### Live-Backend prüfen

```bash
pnpm staff:verify:live
```

Prüft `build-info`, `/sb`-Proxy, Login, `restaurant_employees` und POS-API. Optional: `GWADA_TEST_EMAIL`, `GWADA_TEST_PASSWORD`, `GWADA_TEST_RESTAURANT_ID`.

Falls Login fehlt: `pnpm provision:live:fadi` (braucht `SUPABASE_DB_URL` in `.env.production`).

### EAS Environment `production` setzen (Secrets nicht ins Git)

```bash
pnpm staff:eas-env:production
```

Liest `NEXT_PUBLIC_*` aus `.env.production` oder holt den publishable Key von `https://gwada.app/login` (`data-gwada-public-env`). URLs:

| Variable | Wert |
|----------|------|
| `EXPO_PUBLIC_GWADA_API_URL` | `https://gwada.app` |
| `EXPO_PUBLIC_SUPABASE_URL` | `https://gwada.app/sb` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Live publishable Key |

Build + Submit:

```bash
pnpm staff:verify:live              # optional, vor dem Build
pnpm staff:eas-env:production
pnpm staff:build:ios:production
pnpm staff:submit:ios:production    # braucht ascAppId in eas.json (siehe unten)
```

**TestFlight-Submit (`ascAppId`):** In App Store Connect → Gwada Staff → App-Informationen → **Apple-ID** (10-stellig). In [`eas.json`](../../apps/staff/eas.json) unter `submit.production.ios.ascAppId` eintragen — danach klappt `pnpm staff:submit:ios:production --non-interactive`.

Alternativ: [Expo Build #5](https://expo.dev/accounts/atfadi17/projects/gwada-staff/builds) → **Submit to App Store** (interaktiv).

**iPhone (production, kein WLAN):** Build 5+ installieren → `fadih32@gmail.com` / Live-Passwort → Restaurant **Fadis BurgerStation** → Tische laden (ohne „Backend im WLAN“).

**Hinweis:** Live-DB-Migrationen und App-Deploy sind separat (`deploy-live-db.yml`, Push auf `main`). **Fiskaly LIVE** erst nach erfolgreichem Connect testen (Kasse/Beleg optional).

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
| `pnpm staff:eas-env:production` | `.env.production` / Live → EAS production |
| `pnpm staff:verify:live` | Live-Smoke (Web, Auth, POS) |
| `pnpm staff:build:ios:preview-lan` | EAS iOS-Build LAN |
| `pnpm staff:build:ios:production` | EAS iOS-Build Live |
| `pnpm staff:submit:ios:preview-lan` | TestFlight-Upload (letzter Build) |
| `pnpm staff:submit:ios:production` | App Store Connect (Live) |
| `pnpm staff:update:preview-lan` | OTA: LAN-Env + JS (Channel preview-lan) |
| `pnpm staff:update:production` | OTA: JS (Channel production) |
