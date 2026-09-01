/**
 * Restore regressed purchase orders from protocol log (status + line delivery).
 *
 * Run AFTER the PO overwrite hardening fix is live.
 *
 * Dev (dry-run default):
 *   dotenv -e .env.development -- pnpm recover:po:zurschlag
 *
 * Live apply (requires .env.production or CI tunnel):
 *   GWADA_CONFIRM_LIVE_PO_RECOVERY=1 dotenv -e .env.production -- \
 *     pnpm recover:po:zurschlag -- --apply
 */
import { createClient } from "@supabase/supabase-js";

import {
  findPurchaseOrdersNeedingRecovery,
  type PurchaseOrderRecoveryPatch,
} from "../apps/web/lib/inventory/recover-purchase-orders-from-log.ts";
import { isPurchaseOrderStatus } from "../apps/web/lib/inventory/purchase-order-status.ts";
import type {
  PurchaseOrder,
  PurchaseOrderLine,
  PurchaseOrderLogEntry,
} from "../apps/web/lib/types/purchase-order.ts";

const DEFAULT_SLUG = "zurschlagd";

function parseArgs(argv: string[]) {
  const apply = argv.includes("--apply");
  const dryRun = !apply;
  return { apply, dryRun };
}

function parseLogEntry(raw: unknown): PurchaseOrderLogEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.kind !== "string" || typeof e.at !== "string") return null;
  if (e.kind === "status_change") {
    if (
      !isPurchaseOrderStatus(String(e.fromStatus)) ||
      !isPurchaseOrderStatus(String(e.toStatus))
    ) {
      return null;
    }
  }
  return raw as PurchaseOrderLogEntry;
}

function parseLine(row: Record<string, unknown>): PurchaseOrderLine | null {
  if (typeof row.id !== "string") return null;
  const qty = Number(row.quantity);
  if (!Number.isFinite(qty)) return null;
  return {
    id: row.id,
    ingredientId: String(row.ingredient_id ?? ""),
    ingredientName: String(row.ingredient_name ?? ""),
    quantity: qty,
    unitId: String(row.unit_id ?? ""),
    unitLabel: String(row.unit_label ?? ""),
    ...(typeof row.brand_label === "string" && row.brand_label.trim()
      ? { brandLabel: row.brand_label.trim() }
      : {}),
    ...(typeof row.delivered_at === "string" && row.delivered_at
      ? { deliveredAt: row.delivered_at }
      : {}),
    ...(row.delivery_status === "delivered" ||
    row.delivery_status === "not_delivered" ||
    row.delivery_status === "partial"
      ? { deliveryStatus: row.delivery_status }
      : {}),
    ...(row.delivered_quantity != null && Number.isFinite(Number(row.delivered_quantity))
      ? { deliveredQuantity: Number(row.delivered_quantity) }
      : {}),
    ...(typeof row.delivery_note === "string" && row.delivery_note.trim()
      ? { deliveryNote: row.delivery_note.trim() }
      : {}),
  };
}

async function loadOrders(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
): Promise<PurchaseOrder[]> {
  const { data: orderRows, error: orderErr } = await supabase
    .from("inventory_purchase_orders")
    .select(
      "id,supplier_id,supplier_name,status,created_at,created_by,created_by_user_source,delivery_date",
    )
    .eq("restaurant_id", restaurantId)
    .order("created_at", { ascending: false });
  if (orderErr) throw new Error(`orders: ${orderErr.message}`);

  const { data: lineRows, error: lineErr } = await supabase
    .from("inventory_purchase_order_lines")
    .select(
      "order_id,id,ingredient_id,ingredient_name,brand_label,quantity,unit_id,unit_label,delivered_at,delivery_status,delivered_quantity,delivery_note",
    )
    .eq("restaurant_id", restaurantId);
  if (lineErr) throw new Error(`lines: ${lineErr.message}`);

  const { data: logRows, error: logErr } = await supabase
    .from("inventory_purchase_order_log_entries")
    .select("order_id,sort_order,entry")
    .eq("restaurant_id", restaurantId)
    .order("order_id", { ascending: true })
    .order("sort_order", { ascending: true });
  if (logErr) throw new Error(`log: ${logErr.message}`);

  const linesByOrder = new Map<string, PurchaseOrderLine[]>();
  for (const row of lineRows ?? []) {
    const parsed = parseLine(row as Record<string, unknown>);
    if (!parsed) continue;
    const oid = String((row as Record<string, unknown>).order_id);
    const arr = linesByOrder.get(oid) ?? [];
    arr.push(parsed);
    linesByOrder.set(oid, arr);
  }

  const logByOrder = new Map<string, PurchaseOrderLogEntry[]>();
  for (const row of logRows ?? []) {
    const r = row as Record<string, unknown>;
    const oid = String(r.order_id);
    const ent = parseLogEntry(r.entry);
    if (!ent) continue;
    const arr = logByOrder.get(oid) ?? [];
    arr.push(ent);
    logByOrder.set(oid, arr);
  }

  return (orderRows ?? []).map((row) => {
    const o = row as Record<string, unknown>;
    const id = String(o.id);
    let deliveryDate: string | null = null;
    if (typeof o.delivery_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.delivery_date)) {
      deliveryDate = o.delivery_date;
    }
    const status = isPurchaseOrderStatus(String(o.status)) ? o.status : "open";
    return {
      id,
      supplierId: String(o.supplier_id ?? ""),
      supplierName: String(o.supplier_name ?? ""),
      status,
      createdAt: String(o.created_at ?? ""),
      createdBy: String(o.created_by ?? ""),
      deliveryDate,
      lines: linesByOrder.get(id) ?? [],
      log: logByOrder.get(id) ?? [],
    };
  });
}

function printPatch(patch: PurchaseOrderRecoveryPatch) {
  console.log(
    `- ${patch.supplierName} (${patch.orderId.slice(0, 8)}…): ${patch.currentStatus} → ${patch.targetStatus}`,
  );
  for (const line of patch.linePatches) {
    console.log(
      `    line ${line.ingredientName}: restore delivery (${line.target.deliveryStatus}, qty ${line.target.deliveredQuantity})`,
    );
  }
}

async function applyPatch(
  supabase: ReturnType<typeof createClient>,
  restaurantId: string,
  patch: PurchaseOrderRecoveryPatch,
) {
  if (patch.currentStatus !== patch.targetStatus) {
    const { error } = await supabase
      .from("inventory_purchase_orders")
      .update({ status: patch.targetStatus })
      .eq("restaurant_id", restaurantId)
      .eq("id", patch.orderId)
      .eq("status", patch.currentStatus);
    if (error) throw new Error(`status ${patch.orderId}: ${error.message}`);
  }

  for (const line of patch.linePatches) {
    const { error } = await supabase
      .from("inventory_purchase_order_lines")
      .update({
        delivered_at: line.target.deliveredAt,
        delivery_status: line.target.deliveryStatus,
        delivered_quantity: line.target.deliveredQuantity,
        delivery_note: line.target.deliveryNote,
      })
      .eq("restaurant_id", restaurantId)
      .eq("order_id", patch.orderId)
      .eq("id", line.lineId);
    if (error) throw new Error(`line ${line.lineId}: ${error.message}`);
  }
}

async function main() {
  const { apply, dryRun } = parseArgs(process.argv.slice(2));
  const slug = process.env.GWADA_RESTAURANT_SLUG?.trim() || DEFAULT_SLUG;
  const url =
    process.env.SUPABASE_UPSTREAM_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    console.error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  if (apply && process.env.GWADA_CONFIRM_LIVE_PO_RECOVERY !== "1") {
    console.error(
      "Refusing --apply without GWADA_CONFIRM_LIVE_PO_RECOVERY=1 (safety gate).",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const { data: restaurants, error: rErr } = await supabase
    .from("restaurants")
    .select("id,slug,name")
    .eq("slug", slug)
    .limit(1);
  if (rErr) throw new Error(rErr.message);
  const restaurant = restaurants?.[0];
  if (!restaurant) {
    console.error(`Restaurant slug not found: ${slug}`);
    process.exit(1);
  }

  console.log(`Restaurant: ${restaurant.name} (${restaurant.slug})`);
  console.log(`Mode: ${dryRun ? "DRY-RUN" : "APPLY"}`);

  const orders = await loadOrders(supabase, restaurant.id);
  console.log(`Loaded ${orders.length} purchase order(s).`);

  const suspicious = orders.filter(
    (o) =>
      (o.status === "open" || o.status === "ordered") &&
      o.log.some((e) => e.kind === "status_change" && e.toStatus === "closed"),
  );
  if (suspicious.length > 0) {
    console.log(`\nRegressed orders (open/ordered but log shows closed): ${suspicious.length}`);
    for (const o of suspicious) {
      console.log(`  - ${o.supplierName} ${o.id} status=${o.status} log=${o.log.length}`);
    }
  }

  const patches = findPurchaseOrdersNeedingRecovery(orders);
  if (patches.length === 0) {
    console.log("\nNo recovery patches needed (DB matches log or log has no closed history).");
    if (suspicious.length > 0) {
      console.log(
        "\nWARNING: regressed-looking orders found but patch logic returned empty — inspect manually.",
      );
    }
    return;
  }

  console.log(`\nRecovery patches (${patches.length}):`);
  for (const patch of patches) printPatch(patch);

  if (dryRun) {
    console.log("\nDry-run only. Re-run with --apply and GWADA_CONFIRM_LIVE_PO_RECOVERY=1 to write.");
    return;
  }

  for (const patch of patches) {
    await applyPatch(supabase, restaurant.id, patch);
  }

  const after = await loadOrders(supabase, restaurant.id);
  const remaining = findPurchaseOrdersNeedingRecovery(after);
  if (remaining.length > 0) {
    console.error(`\nERROR: ${remaining.length} patch(es) still pending after apply.`);
    process.exit(1);
  }

  console.log("\nRecovery applied successfully. Re-check Bestellungen in the app.");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
