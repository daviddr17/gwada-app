# Audit: Stale client cache → server overwrite

**Date:** 2026-09-01  
**Scope:** Cross-module pattern review (not limited to purchase orders)  
**Trigger:** User reports data "overwritten" after live deploy; recurring false-unread after deploy

## Executive summary

Live deploy **does not write to the database by itself**. Schema migrations apply structure only; app deploy replaces the container. The corruption pattern is **client-side last-write-wins with full-snapshot persistence**: a tab reloads (or keeps running) with **stale localStorage / React Query placeholder data**, then persists that snapshot via **DELETE-all + INSERT** RPCs. Deploy makes this worse because hard reloads clear in-memory caches while **localStorage survives**, and background jobs (WAHA sync) run against a cold client state.

Unread bell spikes after deploy share the **"stale cache after reload"** theme but are **not** the same mechanism: they are **read-state / summary calculation** bugs, not full-row replacement.

---

## Root cause patterns

### 1. Full-replace persistence (highest severity)

| RPC / API | Tables | Pattern |
|-----------|--------|---------|
| `inventory_replace_purchase_orders` | PO header, lines, log | `DELETE … WHERE restaurant_id` then insert entire JSON array |
| `inventory_replace_ingredients` | ingredients, stock log | Upsert ingredients, but **delete + re-insert entire stock log per ingredient**; drops ingredients missing from payload |
| Display / POS / accounting helpers | same | Load all → patch one row → save all via replace RPC |

**Menu, categories, contacts, reservations** use **row-level** insert/update/delete — safer.

**Why it hurts:** Any save sends the **client's entire snapshot**. Missing rows in the snapshot are **deleted on the server**. Stale cache = silent data loss or status regression (e.g. closed PO → open).

### 2. Stale localStorage + optimistic SWR (amplifier)

Flow documented in `use-purchase-orders-storage.ts` and `purchase-orders-query.ts`:

1. `peekPurchaseOrdersCache()` reads **localStorage** (survives deploy reload).
2. React Query uses it as `placeholderData` and `orders` fallback until fetch completes.
3. `isHydrated` becomes `true` when LS has rows — **before** DB fetch finishes.
4. Side effects (e.g. empty-open prune) or user edits call `savePurchaseOrdersRelational` → full replace.

Same mirror pattern exists for **ingredients** (`INGREDIENT_STORAGE_KEY`), menu lists, categories, dashboard widgets — but only inventory PO/ingredients use full-replace RPCs on save.

### 3. Cross-client / cross-surface races

| Surface | Behavior |
|---------|----------|
| Dashboard Bestand | Client hook → `inventory_replace_*` |
| Display tablet | Server `display-inventory-server.ts` → load all → save all |
| POS booking | `pos-inventory-booking-server.ts` → load all → deduct → replace all |
| Accounting invoice deduction | Same ingredients replace |

Two sessions editing concurrently: **last full snapshot wins**; no merge, no version vector, no row-level locking.

### 4. Unread / bell (related symptom, different mechanism)

Fixes on `fix-false-unread-after-deploy`, `fix-bell-unread-after-live` (merged ~2e07536f):

- After deploy, **sessionStorage inbox cache** is empty; bell used a **400-row light scan** that mis-counted unreads.
- **WAHA cron catch-up** could set `external_seen = false` on rows already marked read in Gwada → false unread resurfacing.

These are **read-state / aggregation** bugs, not DELETE+INSERT data loss. Same **deploy clears hot cache, cold path uses stale or incomplete data** narrative.

### 5. What deploy actually does

| Layer | On app deploy |
|-------|----------------|
| Database | Schema only (migrations); **no row overwrite** unless a client writes |
| React Query / sessionStorage | Cleared or cold on full reload |
| localStorage (`mirrorWorkspaceJsonLocal`) | **Persists** across deploy |
| Service worker | Not used for app shell caching in this repo |
| `/api/build-info` | Version probe only; no cache invalidation hook to clients |
| Legacy migrate (`app-state-relational-migration`) | Runs only when DB table **empty** — not on every deploy |

**Conclusion:** Deploy is a **trigger**, not the writer. Stale LS + full-replace save is the writer.

---

## Affected modules

| Module | Risk | Mechanism |
|--------|------|-----------|
| **Purchase orders** | **Critical** | Full replace; stale LS hydrate; Display race; merge + fetch-gate in `fix-po-overwrite-hardening` |
| **Ingredients / stock** | **High** | Full replace; POS + Display + Dashboard; merge + fetch-gate in `fix-ingredients-overwrite-hardening` |
| **Unread / bell** | Medium (UX) | Stale inbox cache + WAHA sync; fixed in main for deploy spike |
| Menu / categories / tags | Low | Incremental CRUD |
| Dashboard widgets | Low | Per-user upsert; legacy migrate gated on empty |
| Notifications (non-messages) | Low | Event inserts + read markers |

---

## Why it feels worse after live deploy

1. Users **hard-refresh** or get new chunks → React Query empty, **localStorage still old**.
2. Multiple tabs (Dashboard + Display) — one tab may not refetch immediately (`staleTime` 60s+).
3. **Auto-persist on mount** (empty-open PO prune) could fire on stale snapshot before fetch (mitigated on audit branch).
4. Background **WAHA sync** after deploy can disturb read flags (messages).
5. Display **periodic hard reload** (2h / resume) increases load-modify-save cycles on server paths without client-side merge.

---

## Recommended architectural fixes

### Short term (inventory)

1. **Merge-before-save** for PO: load DB rows, merge client snapshot, then replace — `merge-purchase-orders-for-replace.ts`, `savePurchaseOrdersRelational`, Display `savePurchaseOrdersAdmin`.
2. **Merge-before-save** for ingredients: `merge-ingredients-for-replace.ts`, `saveIngredientsRelational`, Display `saveIngredientsAdmin`, POS/accounting `replaceIngredientsWithMerge`.
3. **Gate auto-persist and all saves** until `ordersQuery.isSuccess` / `ingredientsQuery.isSuccess` when using DB mode — `use-purchase-orders-storage.ts`, `use-ingredients-storage.ts`.
4. **After save:** refetch/patch cache with DB truth (not raw client `next`).
5. Workspace rule: `.cursor/rules/no-stale-client-overwrite.mdc`.

### Medium term

4. Replace `inventory_replace_purchase_orders` with **incremental RPCs** (upsert order/line, delete line, status transition) — mirror menu-db.
5. Add **`updated_at` / revision** per PO (or log length + status rank) for deterministic merge.
6. **Version stamp in localStorage**: on fetch success, write `cachedAt` + `buildSha`; ignore LS placeholder if `buildSha !== current` until refetch.

### Long term

7. **Row-level APIs** everywhere; ban restaurant-scoped DELETE-all RPCs from client paths.
8. Optional **optimistic locking** (`WHERE updated_at = $expected`) on hot entities.
9. **Deploy hook** (optional): broadcast `GWADA_BUILD_SHA` via SSE or poll `/api/build-info`; invalidate module caches when SHA changes — do **not** auto-persist on SHA change.

---

## Data recovery

| Data | User action needed? |
|------|---------------------|
| **Lost PO lines / reverted PO status** | **Yes** — audit DB backups / Supabase PITR if available; re-enter missing orders manually. No automatic repair in app today. |
| **Ingredient stock drift** | Review stock log vs physical count; manual correction in Bestand. |
| **False unread messages** | Usually self-heals after mark-read or inbox refresh; if persistent, check `contact_messages.external_seen` for affected threads. |

---

## References (code)

- Full replace PO: `supabase/migrations/20250517200000_inventory_and_purchase_orders.sql` (`inventory_replace_purchase_orders`)
- Ingredients upsert + log replace: `supabase/migrations/20260622130000_notification_dedup_inventory_upsert.sql`
- Client PO hook: `apps/web/lib/hooks/use-purchase-orders-storage.ts`
- LS mirror: `apps/web/lib/supabase/workspace-persistence.ts` (`mirrorWorkspaceJsonLocal`)
- Display server save: `apps/web/lib/display/display-inventory-server.ts`
- Unread deploy fix: commit `2e07536f` — `unread-summary-server.ts`, `sync-contact-whatsapp-inbound.ts`
- Pending PO merge: `merge-purchase-orders-for-replace.ts` (merged in `cursor/fix-po-overwrite-hardening-dd85`)
- Ingredients merge: `merge-ingredients-for-replace.ts`, `replace-ingredients-with-merge.ts` (merged in `cursor/fix-ingredients-overwrite-hardening-dd85`)
- Cache policy: `apps/web/lib/dashboard/module-data-cache-policy.ts`
