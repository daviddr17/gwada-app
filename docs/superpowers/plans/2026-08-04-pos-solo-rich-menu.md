# POS Solo Rich Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Solo Debug zeigt Speisekarte mit Ohne (Rezept), Beilagen-Pool (einzeln + am Gericht) und Freitext-Notiz — reiches Demo lokal, Dev-Seed für `zurschlagd` bei Cloud-Bootstrap.

**Architecture:** Bestehendes Bootstrap-Modell unverändert. Swift-Demo (`DemoSnapshotFactory`) um Beilagen + Schnitzel-`recipe`/`sides` erweitern. Idempotentes Dev-SQL für `zurschlagd` (Kategorie Beilagen, Pommes/Kroketten, Side-Config, minimale Inventory-Zutaten + Rezept). Solo-Laufzeit bleibt Prefer-Cloud → Fallback Demo.

**Tech Stack:** SwiftUI POS (`apps/pos`), XCTest, Postgres/Supabase Dev-DB

**Spec:** `docs/superpowers/specs/2026-08-04-pos-solo-rich-menu-design.md`

## Global Constraints

- Kein Live-Schreiben; Seed nur Dev.
- Keine Option-Groups für Pommes/Kroketten.
- Demo-IDs/Namen bestehender Artikel unverändert (`item-schnitzel` / `Wiener Schnitzel`, …).
- `PosMenuSidePool.sideCategoryName == "Beilagen"`.
- UITests bleiben Demo-Namen; kein Cloud-Zwang in UITests.
- Commits nur wenn der Nutzer sie ausdrücklich anfordert (Schritte unten optional markieren).

---

## File map

| File | Role |
|------|------|
| `apps/pos/Sources/Cloud/PosBootstrapModels.swift` | Memberwise `init` für `PosCloudRecipeIngredient` |
| `apps/pos/Sources/LAN/DemoSnapshotFactory.swift` | Reiches Demo-Menü |
| `apps/pos/Tests/GwadaPOSTests/PosDemoRichMenuTests.swift` | Unit-Tests Demo + Side-Pool |
| `supabase/seed_pos_solo_rich_menu_zurschlagd.sql` | Idempotenter Dev-Seed |
| `scripts/seed-pos-solo-rich-menu-dev.sh` | Wrapper: Dev-Tunnel + `psql` |
| `package.json` | Script `db:seed:pos-solo-menu` (optional shortcut) |

Keine Änderung an `PosRuntime` / Bootstrap-Server nötig, wenn Prefer-Cloud bereits gilt.

---

### Task 1: Recipe memberwise init + failing Demo tests

**Files:**
- Modify: `apps/pos/Sources/Cloud/PosBootstrapModels.swift`
- Create: `apps/pos/Tests/GwadaPOSTests/PosDemoRichMenuTests.swift`

**Interfaces:**
- Produces: `PosCloudRecipeIngredient.init(ingredientId:name:amount:)`
- Consumes: `DemoSnapshotFactory.makeDemoMenu()`, `PosMenuSidePool.sideItems(from:)`

- [ ] **Step 1: Write failing tests**

```swift
import XCTest
@testable import GwadaPOS

final class PosDemoRichMenuTests: XCTestCase {
    func test_demoMenu_hasBeilagenCategoryAndSideItems() {
        let menu = DemoSnapshotFactory.makeDemoMenu()
        XCTAssertTrue(menu.categories.contains { $0.name == "Beilagen" })
        let sides = PosMenuSidePool.sideItems(from: menu)
        XCTAssertEqual(Set(sides.map(\.name)), Set(["Pommes", "Kroketten"]))
        XCTAssertEqual(sides.first { $0.name == "Pommes" }?.priceCents, 450)
        XCTAssertEqual(sides.first { $0.name == "Pommes" }?.sidePriceCents, 450)
        XCTAssertEqual(sides.first { $0.name == "Kroketten" }?.priceCents, 490)
        XCTAssertEqual(sides.first { $0.name == "Kroketten" }?.sidePriceCents, 490)
    }

    func test_demoSchnitzel_hasRecipeAndSidesConfig() {
        let menu = DemoSnapshotFactory.makeDemoMenu()
        let schnitzel = menu.items.first { $0.id == "item-schnitzel" }
        XCTAssertEqual(schnitzel?.name, "Wiener Schnitzel")
        let recipeNames = Set(schnitzel?.recipe?.map(\.name) ?? [])
        XCTAssertEqual(recipeNames, Set(["Tomaten", "Zwiebeln"]))
        XCTAssertEqual(schnitzel?.sides?.required, false)
        XCTAssertEqual(schnitzel?.sides?.max, 2)
        XCTAssertEqual(schnitzel?.sides?.includedCount, 1)
    }

    func test_demo_optionGroups_empty() {
        XCTAssertTrue(DemoSnapshotFactory.makeDemoMenu().optionGroups.isEmpty)
    }
}
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
cd apps/pos
xcodebuild test -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:GwadaPOSTests/PosDemoRichMenuTests \
  -derivedDataPath /tmp/gwada-pos-rich-menu 2>&1 | tail -40
```

Expected: FAIL (Beilagen / recipe fehlen) oder compile error if recipe init missing when implementing.

- [ ] **Step 3: Add memberwise init on `PosCloudRecipeIngredient`**

In `PosBootstrapModels.swift`, after the `encode` method of `PosCloudRecipeIngredient`, add:

```swift
init(ingredientId: String, name: String, amount: Double) {
    self.ingredientId = ingredientId
    self.name = name
    self.amount = amount
}
```

- [ ] **Step 4: Commit (nur auf Nutzer-Anfrage)**

```bash
git add apps/pos/Sources/Cloud/PosBootstrapModels.swift apps/pos/Tests/GwadaPOSTests/PosDemoRichMenuTests.swift
git commit -m "test(pos): Demo rich-menu assertions (red)"
```

---

### Task 2: Enrich `DemoSnapshotFactory.makeDemoMenu`

**Files:**
- Modify: `apps/pos/Sources/LAN/DemoSnapshotFactory.swift`

**Interfaces:**
- Consumes: `PosCloudRecipeIngredient.init`, `PosCloudMenuItemSideConfig`, existing `PosCloudMenuItem` full init
- Produces: Demo catalog with `cat-sides`, `item-pommes`, `item-kroketten`, enriched `item-schnitzel`

- [ ] **Step 1: Add category + IDs**

Add next to existing private static lets:

```swift
private static let catBeilagen = "cat-sides"
```

- [ ] **Step 2: Replace `makeDemoMenu()` body**

```swift
static func makeDemoMenu() -> PosCloudMenuCatalog {
    PosCloudMenuCatalog(
        categories: [
            PosCloudMenuCategory(id: catVorspeisen, name: "Vorspeisen", sortOrder: 0),
            PosCloudMenuCategory(id: catHaupt, name: "Hauptgerichte", sortOrder: 1),
            PosCloudMenuCategory(id: catBeilagen, name: "Beilagen", sortOrder: 2),
            PosCloudMenuCategory(id: catGetranke, name: "Getränke", sortOrder: 3),
        ],
        items: [
            .demo(id: "item-suppe", name: "Tagessuppe", description: "Mit Brot", priceCents: 650, categoryId: catVorspeisen),
            .demo(id: "item-salat", name: "Haussalat", description: "", priceCents: 890, categoryId: catVorspeisen),
            PosCloudMenuItem(
                id: "item-schnitzel",
                name: "Wiener Schnitzel",
                description: "mit Beilage nach Wahl",
                priceCents: 1850,
                sidePriceCents: nil,
                sides: PosCloudMenuItemSideConfig(required: false, max: 2, includedCount: 1),
                vatRate: 0.19,
                categoryId: catHaupt,
                listNumber: nil,
                optionGroupIds: [],
                recipe: [
                    PosCloudRecipeIngredient(ingredientId: "demo-ing-tomato", name: "Tomaten", amount: 1),
                    PosCloudRecipeIngredient(ingredientId: "demo-ing-onion", name: "Zwiebeln", amount: 1),
                ],
                active: true
            ),
            .demo(id: "item-pasta", name: "Pasta Arrabbiata", description: "", priceCents: 1490, categoryId: catHaupt),
            PosCloudMenuItem(
                id: "item-pommes",
                name: "Pommes",
                description: "",
                priceCents: 450,
                sidePriceCents: 450,
                sides: nil,
                vatRate: 0.19,
                categoryId: catBeilagen,
                listNumber: 1,
                optionGroupIds: [],
                recipe: nil,
                active: true
            ),
            PosCloudMenuItem(
                id: "item-kroketten",
                name: "Kroketten",
                description: "",
                priceCents: 490,
                sidePriceCents: 490,
                sides: nil,
                vatRate: 0.19,
                categoryId: catBeilagen,
                listNumber: 2,
                optionGroupIds: [],
                recipe: nil,
                active: true
            ),
            .demo(id: "item-cola", name: "Cola 0,4", description: "", priceCents: 390, categoryId: catGetranke),
            .demo(id: "item-wasser", name: "Mineralwasser", description: "", priceCents: 320, categoryId: catGetranke),
        ],
        optionGroups: []
    )
}
```

- [ ] **Step 3: Run `PosDemoRichMenuTests` — expect PASS**

Same `xcodebuild` command as Task 1 Step 2. Expected: PASS.

- [ ] **Step 4: Run existing side-pool + menu-cache tests**

```bash
xcodebuild test -scheme GwadaPOS -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:GwadaPOSTests/PosMenuSidePoolTests \
  -only-testing:GwadaPOSTests/PosMenuCacheMergeTests \
  -only-testing:GwadaPOSTests/PosDemoRichMenuTests \
  -derivedDataPath /tmp/gwada-pos-rich-menu 2>&1 | tail -50
```

Expected: all PASS.

- [ ] **Step 5: Commit (nur auf Nutzer-Anfrage)**

```bash
git add apps/pos/Sources/LAN/DemoSnapshotFactory.swift
git commit -m "feat(pos): rich Solo demo menu with sides and recipe"
```

---

### Task 3: Dev-Seed SQL für `zurschlagd`

**Files:**
- Create: `supabase/seed_pos_solo_rich_menu_zurschlagd.sql`
- Create: `scripts/seed-pos-solo-rich-menu-dev.sh`
- Modify: `package.json` (add `"db:seed:pos-solo-menu": "bash scripts/seed-pos-solo-rich-menu-dev.sh"`)

**Interfaces:**
- Produces: Dev rows — Beilagen-Kat, Pommes/Kroketten UUIDs, side_config, inventory ingredients `pos-solo-tomato` / `pos-solo-onion`, recipe on Schnitzel-or-Haupt
- Seed UUID namespace: `a8e40000-0000-4000-8000-*`

- [ ] **Step 1: Write SQL** (`supabase/seed_pos_solo_rich_menu_zurschlagd.sql`)

Full file content:

```sql
-- Dev-only: POS Solo rich menu for zurschlagd (Beilagen + recipe + side_config).
-- Idempotent. Skip if restaurant missing. Do NOT run against Live.

do $$
declare
  rid uuid;
  cat_beilagen uuid;
  cat_haupt uuid;
  main_id uuid;
  pommes_id uuid := 'a8e40000-0000-4000-8000-000000000001';
  kroketten_id uuid := 'a8e40000-0000-4000-8000-000000000002';
  unit_id text;
  sup_id text;
  ic_id text;
  ps_id text;
  br_id text;
begin
  select id into rid from public.restaurants where slug = 'zurschlagd' limit 1;
  if rid is null then
    raise notice 'seed_pos_solo_rich_menu: zurschlagd missing — skip';
    return;
  end if;

  -- Beilagen category (reuse by name)
  select id into cat_beilagen
  from public.menu_categories
  where restaurant_id = rid
    and lower(name) = 'beilagen'
  limit 1;

  if cat_beilagen is null then
    cat_beilagen := 'a8e40000-0000-4000-8000-000000000010';
    insert into public.menu_categories (id, restaurant_id, name, sort_order, is_active)
    values (cat_beilagen, rid, 'Beilagen', 50, true)
    on conflict (id) do update set name = excluded.name, is_active = true;
  end if;

  insert into public.menu_items (
    id, restaurant_id, category_id, name, description, price, side_price_cents, is_active, list_number
  ) values
    (pommes_id, rid, cat_beilagen, 'Pommes', '', 4.50, 450, true, 1),
    (kroketten_id, rid, cat_beilagen, 'Kroketten', '', 4.90, 490, true, 2)
  on conflict (id) do update set
    category_id = excluded.category_id,
    name = excluded.name,
    price = excluded.price,
    side_price_cents = excluded.side_price_cents,
    is_active = true,
    list_number = excluded.list_number;

  -- Prefer Schnitzel Haupt; else first active Hauptgerichte item
  select id into main_id
  from public.menu_items mi
  join public.menu_categories mc on mc.id = mi.category_id
  where mi.restaurant_id = rid
    and mi.is_active
    and mi.name ilike '%schnitzel%'
  order by mi.name
  limit 1;

  if main_id is null then
    select mc.id into cat_haupt
    from public.menu_categories mc
    where mc.restaurant_id = rid and lower(mc.name) = 'hauptgerichte'
    limit 1;

    if cat_haupt is not null then
      select mi.id into main_id
      from public.menu_items mi
      where mi.restaurant_id = rid and mi.category_id = cat_haupt and mi.is_active
      order by mi.list_number nulls last, mi.name
      limit 1;
    end if;
  end if;

  if main_id is null then
    raise notice 'seed_pos_solo_rich_menu: no Haupt for side/recipe — skip config';
  else
    insert into public.menu_item_side_config (
      menu_item_id, restaurant_id, required, max_sides, included_count
    ) values (main_id, rid, false, 2, 1)
    on conflict (menu_item_id) do update set
      required = excluded.required,
      max_sides = excluded.max_sides,
      included_count = excluded.included_count,
      restaurant_id = excluded.restaurant_id;

    -- Minimal inventory taxonomy (only if we can attach FKs)
    select id into unit_id from public.inventory_units where restaurant_id = rid limit 1;
    select id into sup_id from public.inventory_suppliers where restaurant_id = rid limit 1;
    select id into ic_id from public.inventory_ingredient_categories where restaurant_id = rid limit 1;
    select id into ps_id from public.inventory_production_sites where restaurant_id = rid limit 1;
    select id into br_id from public.inventory_brands where restaurant_id = rid limit 1;

    if unit_id is null then
      insert into public.inventory_units (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-g', 'Gramm (g)', 0, true)
      on conflict (restaurant_id, id) do nothing;
      unit_id := 'pos-solo-g';
    end if;
    if sup_id is null then
      insert into public.inventory_suppliers (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-sup', 'POS Solo', 0, true)
      on conflict (restaurant_id, id) do nothing;
      sup_id := 'pos-solo-sup';
    end if;
    if ic_id is null then
      insert into public.inventory_ingredient_categories (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-ic', 'POS Solo', 0, true)
      on conflict (restaurant_id, id) do nothing;
      ic_id := 'pos-solo-ic';
    end if;
    if ps_id is null then
      insert into public.inventory_production_sites (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-ps', 'Küche', 0, true)
      on conflict (restaurant_id, id) do nothing;
      ps_id := 'pos-solo-ps';
    end if;
    if br_id is null then
      insert into public.inventory_brands (restaurant_id, id, name, sort_order, is_active)
      values (rid, 'pos-solo-br', 'Haus', 0, true)
      on conflict (restaurant_id, id) do nothing;
      br_id := 'pos-solo-br';
    end if;

    insert into public.inventory_ingredients (
      restaurant_id, id, name, unit, current_stock, supplier_id, category_id,
      production_site_id, brand_id, is_active
    ) values
      (rid, 'pos-solo-tomato', 'Tomaten', unit_id, 0, sup_id, ic_id, ps_id, br_id, true),
      (rid, 'pos-solo-onion', 'Zwiebeln', unit_id, 0, sup_id, ic_id, ps_id, br_id, true)
    on conflict (restaurant_id, id) do update set name = excluded.name, is_active = true;

    insert into public.menu_item_recipe_lines (menu_item_id, ingredient_id, amount, sort_order)
    values
      (main_id, 'pos-solo-tomato', 1, 0),
      (main_id, 'pos-solo-onion', 1, 1)
    on conflict (menu_item_id, ingredient_id) do update set amount = excluded.amount, sort_order = excluded.sort_order;

    raise notice 'seed_pos_solo_rich_menu: configured main % with sides+recipe', main_id;
  end if;
end $$;
```

**Note:** Verify `menu_item_side_config` unique key is `menu_item_id` (primary key in migration). If PK differs, adjust `on conflict` to match actual constraint before applying.

- [ ] **Step 2: Confirm side_config PK**

```bash
rg -n "create table.*menu_item_side_config|primary key|unique" supabase/migrations/20260724120300_menu_item_side_config.sql
```

If PK is only `menu_item_id`, Step 1 SQL is correct. If different, fix SQL before applying.

- [ ] **Step 3: Write shell wrapper**

`scripts/seed-pos-solo-rich-menu-dev.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
if [[ ! -f .env.development ]]; then
  echo ".env.development fehlt" >&2
  exit 1
fi
set -a
# shellcheck disable=SC1091
source <(grep -E '^SUPABASE_DB_URL=' .env.development)
set +a
if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "SUPABASE_DB_URL fehlt" >&2
  exit 1
fi
if ! nc -z 127.0.0.1 5434 2>/dev/null; then
  echo "Dev-DB-Tunnel down. Start: pnpm db:tunnel:dev" >&2
  exit 1
fi
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$ROOT/supabase/seed_pos_solo_rich_menu_zurschlagd.sql"
echo "✓ seed_pos_solo_rich_menu applied (Dev)"
```

```bash
chmod +x scripts/seed-pos-solo-rich-menu-dev.sh
```

- [ ] **Step 4: Add package.json script**

Under `"scripts"`:

```json
"db:seed:pos-solo-menu": "bash scripts/seed-pos-solo-rich-menu-dev.sh"
```

- [ ] **Step 5: Apply on Dev** (tunnel muss laufen)

```bash
pnpm db:tunnel:dev   # separates Terminal, if needed
pnpm db:seed:pos-solo-menu
```

Expected: notice about configured main, or skip if no `zurschlagd`.

- [ ] **Step 6: Spot-check SQL (read-only)**

```sql
SELECT mi.name, mi.side_price_cents, mc.name AS cat
FROM menu_items mi
JOIN menu_categories mc ON mc.id = mi.category_id
JOIN restaurants r ON r.id = mi.restaurant_id
WHERE r.slug = 'zurschlagd' AND mi.name IN ('Pommes','Kroketten');

SELECT sc.* FROM menu_item_side_config sc
JOIN restaurants r ON r.id = sc.restaurant_id WHERE r.slug = 'zurschlagd';

SELECT rl.ingredient_id, ii.name
FROM menu_item_recipe_lines rl
JOIN menu_items mi ON mi.id = rl.menu_item_id
JOIN restaurants r ON r.id = mi.restaurant_id
LEFT JOIN inventory_ingredients ii ON ii.restaurant_id = r.id AND ii.id = rl.ingredient_id
WHERE r.slug = 'zurschlagd' AND rl.ingredient_id LIKE 'pos-solo-%';
```

Expected: 2 Beilagen rows; ≥1 side_config; tomato/onion recipe with names.

- [ ] **Step 7: Commit (nur auf Nutzer-Anfrage)**

```bash
git add supabase/seed_pos_solo_rich_menu_zurschlagd.sql scripts/seed-pos-solo-rich-menu-dev.sh package.json
git commit -m "chore(db): Dev seed POS Solo rich menu for zurschlagd"
```

---

### Task 4: Manual Solo smoke + Done

**Files:** none (verify)

- [ ] **Step 1: Solo without enrollment**

Simulator → DEBUG Solo → Tisch → Wiener Schnitzel → Sheet:
- Abschnitt Ohne: Tomaten, Zwiebeln
- Beilagen: Pommes, Kroketten
- Hinweis Freitext
- Pommes auch allein aus Beilagen-Kategorie bestellbar

- [ ] **Step 2: Solo with Dev enrollment (optional)**

Enrollment für `zurschlagd` → Bootstrap → gleiche Semantik mit Dev-Artikeln; Label `Solo · Cloud`.

- [ ] **Step 3: Mark Spec success criteria**

Spec Erfolgskriterien 1–5 erfüllt.

---

## Done when

1. `PosDemoRichMenuTests` grün  
2. Solo Demo: Schnitzel mit Ohne + Beilagen + Notiz; Pommes einzeln  
3. Dev-Seed angewendet (oder bewusst skipped weil kein `zurschlagd`)  
4. Kein Live-Schreiben  
5. Bestehende UITest-Namen weiterhin gültig
