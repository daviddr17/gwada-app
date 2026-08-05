# POS Solo: reiche Speisekarte (Demo + Dev `zurschlagd`)

**Datum:** 2026-08-04  
**Branch:** `cursor/pos-layout-parity-2026-07-30`  
**Status:** Approved

## Problem

Solo Debug fällt ohne Cloud-Bootstrap auf ein flaches Demo-Menü zurück (keine Beilagen, kein Rezept → kein „Ohne …“, keine Side-Config). Die Bestell-UI (`LineConfigureSheet`) kann die neuen Felder schon — die Daten fehlen.

Ziel: Solo zeigt die **neuen Speisekarten-Felder** (Notiz, Ohne, Beilagen einzeln + am Gericht), gespeist aus **Dev** wenn Enrollment greift, sonst aus einem **reichen Demo**.

## Entscheidungen (fest)

| # | Entscheidung |
|---|----------------|
| 1C | Cloud wenn erreichbar (Enrollment), sonst reiches Demo |
| 2B | Cloud-Restaurant: **`zurschlagd`** auf Dev |
| 3A | Solo ohne Staff-Login; Device-/Enrollment-Creds wenn vorhanden |
| 4 | Ohne ← Rezept; Beilage am Gericht ← Side-Pool + `sides`; kein paralleler Option-Group-Use-Case für denselben Artikel |
| 5 | **Ein** Artikel z. B. Pommes = einzeln bestellbar **und** Side am Schnitzel |
| 6A | „Weglassen“ nur aus Rezept-Zutaten |
| 7A | Notiz nur Freitext (kein Admin-Chip) |
| 8 | UITests bleiben auf stabilen Demo-Namen (`Wiener Schnitzel`, …) |
| 9 | Seed/Demo-Daten mitliefern |
| 10 | Nicht im Slice: Allergene, Tags, Bilder, Tageskarte, Live-Prod-Menü |

## Ansatz

**C:** Reiches Swift-Demo **und** idempotenter Dev-Seed für `zurschlagd` mit gleicher Semantik.

## Datenmodell (verbindlich)

```
Ohne X          ← menu_item_recipe_lines → bootstrap.recipe[]
Beilage am Gang ← menu_item_side_config + Kategorie name "Beilagen"
                  + menu_items.side_price_cents (Preis als Side)
Beilage einzeln ← dasselbe menu_item in Kategorie "Beilagen"
Notiz           ← PosCartLine.notes (nur Client, nicht Stammdaten)
```

**Verboten in diesem Slice:** Option-Groups als Ersatz für den Beilagen-Pool (Pommes/Kroketten).

Pool-Regel unverändert: `PosMenuSidePool.sideCategoryName == "Beilagen"` (case/diacritic-insensitive).

## Demo (Swift)

**Datei:** `apps/pos/Sources/LAN/DemoSnapshotFactory.swift`

- Kategorie **Beilagen** ergänzen (`cat-sides`).
- Items **Pommes** (`item-pommes`), **Kroketten** (`item-kroketten`) in Beilagen.
- Preise Demo: Pommes `priceCents`/`sidePriceCents` = 450; Kroketten = 490 (gleich für Einzelverkauf und als Side).
- **Wiener Schnitzel** (`item-schnitzel`):
  - `recipe`: Tomaten (`demo-ing-tomato`), Zwiebeln (`demo-ing-onion`).
  - `sides`: `{ required: false, max: 2, includedCount: 1 }`.
- Bestehende IDs/Namen der bisherigen Demo-Artikel **nicht** umbenennen (UITests).
- `optionGroups: []` bleibt leer für diesen Slice.
- Volle `PosCloudMenuItem`-Inits für Schnitzel/Beilagen; `.demo(...)` nur für einfache Artikel ohne sides/recipe.

## Dev-Seed (`zurschlagd`)

- Idempotentes SQL: `supabase/seed_pos_solo_rich_menu_zurschlagd.sql` (oder gleichwertig unter `scripts/`), **nur Dev** anwenden (`psql` gegen Dev-Tunnel / `pnpm db:seed`-Hook wenn vorhanden) — **kein Live**, keine Migration die Prod-Daten ändert.
- Lookup `restaurants.slug = 'zurschlagd'`. Fehlt der Tenant → `RAISE NOTICE` und **return** (kein Tenant-Create in diesem Slice).
- Sicherstellen (create-or-update by stabile UUIDs im Seed-Namespace):
  - Kategorie Name **Beilagen** (bestehende Kat gleichen Namens wiederverwenden, sonst insert).
  - Aktive Items Pommes + Kroketten in Beilagen; `side_price_cents` gesetzt (4.50 / 4.90 EUR).
  - Ein Hauptgericht: wenn Name enthält „Schnitzel“ (case-insensitive) → dieses; sonst erstes aktives Item in „Hauptgerichte“; sonst skip Side/Rezept mit Notice.
  - Für gewähltes Haupt: `menu_item_side_config` (`required=false`, `max_sides=2`, `included_count=1`); Rezept-Linien „Tomaten“/„Zwiebeln“ — Ingredients idempotent anlegen falls Inventory-Tabelle das erlaubt, sonst nur an bestehende Ingredients binden und fehlende mit Notice skippen.

## Solo-Laufzeit

Unverändertes Prefer-Cloud-Verhalten in `PosRuntime.pullCloudBootstrap` / `startHandheldSolo`:

1. Enrollment/Creds + erfolgreicher Bootstrap → Dev-Menü (`Solo · Cloud`).
2. Sonst Cache oder `DemoSnapshotFactory` → jetzt **reiches** Demo (`Solo · Demo/Cache`).

Kein neuer DEBUG-Service-Role-Endpoint. Kein Live-Channel (`PosEnvironment` bleibt `devVps`).

## Tests

| Art | Was |
|-----|-----|
| Unit | Demo-Menü: ≥1 Beilagen-Kat, ≥2 Side-Items, Schnitzel mit non-empty `recipe` + non-nil `sides` |
| Unit | `PosMenuSidePool.sideItems` liefert Pommes/Kroketten aus Demo-Katalog |
| UITest | Bestehende Smokes (Historie, OrderFlow, …) weiter mit Demo-Namen; **kein** Zwang auf Dev-Cloud |

Manuell: Solo ohne Creds → Schnitzel → Sheet mit Ohne/Beilagen/Hinweis; mit Enrollment gegen Dev → `zurschlagd`-Artikel.

## Out of Scope

- Live-DB / Prod-Menü-Kopie  
- Notiz-Vorlagen / Admin-Chips  
- Separates „Weglassen“-Stammdatum  
- Option-Groups für Beilagen-Extras  
- Web-UI-Änderungen an Speisekarte (außer Seed-Daten)  
- Allergene, Tags, Bilder, Tageskarte in POS-Bootstrap

## Erfolgskriterien

1. Solo Debug ohne Cloud: Schnitzel konfigurierbar mit Ohne + Beilagen + Notiz.  
2. Pommes im Browser einzeln und am Schnitzel als Side.  
3. UITests grün mit Demo-Namen.  
4. Dev `zurschlagd` nach Seed: Bootstrap liefert gleiche Semantik (Side-Pool + recipe).  
5. Kein Live-Schreiben.
