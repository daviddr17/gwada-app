import "server-only";

import { getOpenRegisterSession } from "@/lib/pos/register-report-aggregate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

// Multi-step bag writes use ordering + compensating deletes; the Supabase JS admin
// client cannot run SQL transactions (BEGIN/COMMIT) across separate table calls.

export type CashBagStatus = "open" | "handed_over" | "closed";

type CashBagMovementRow = {
  kind: string;
  amount_cents: number;
};

type WaiterCashBagRow = {
  id: string;
  restaurant_id: string;
  register_session_id: string;
  staff_profile_id: string;
  status: CashBagStatus;
  opening_float_cents: number;
  closing_count_cents: number | null;
  difference_cents: number | null;
  opened_at: string;
  closed_at: string | null;
  opened_by_profile_id: string | null;
  closed_by_profile_id: string | null;
  manager_override_profile_id: string | null;
  handed_over_to_bag_id: string | null;
};

/** Soll = opening_float_cents + sum(cash_sale) − sum(drop_in); float_out is informational only. */
export function bagExpectedCents(params: {
  openingFloatCents: number;
  movements: { kind: string; amount_cents: number }[];
}): number {
  let sales = 0;
  let drops = 0;
  for (const m of params.movements) {
    if (m.kind === "cash_sale") sales += m.amount_cents;
    if (m.kind === "drop_in") drops += m.amount_cents;
  }
  return params.openingFloatCents + sales - drops;
}

/** Stable idempotency key for cash_sale movements tied to a payment. */
export function cashSaleIdempotencyKey(
  paymentId: string,
  clientAttemptId?: string | null,
): string {
  const attempt = clientAttemptId?.trim();
  return attempt ? `cash_sale:${attempt}` : `cash_sale:${paymentId}`;
}

/**
 * Compensating delete for cash_sale journal rows after a failed collect
 * (payment may be deleted separately — movements have no FK cascade).
 */
export async function deleteCashSaleMovementForPayment(params: {
  restaurantId: string;
  paymentId: string;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin
    .from("pos_waiter_cash_bag_movements")
    .delete()
    .eq("restaurant_id", params.restaurantId)
    .eq("payment_id", params.paymentId)
    .eq("kind", "cash_sale");
  if (error) {
    console.warn(
      "[pos] delete cash_sale movement for payment",
      params.paymentId,
      error.message,
    );
  }
}

async function loadBagMovements(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  cashBagId: string,
): Promise<CashBagMovementRow[]> {
  const { data, error } = await admin
    .from("pos_waiter_cash_bag_movements")
    .select("kind, amount_cents")
    .eq("cash_bag_id", cashBagId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("[pos] load bag movements", error.message);
    return [];
  }

  return (data ?? []) as CashBagMovementRow[];
}

async function findOpenBagForStaff(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  staffProfileId: string,
): Promise<WaiterCashBagRow | null> {
  const { data } = await admin
    .from("pos_waiter_cash_bags")
    .select(
      "id, restaurant_id, register_session_id, staff_profile_id, status, opening_float_cents, closing_count_cents, difference_cents, opened_at, closed_at, opened_by_profile_id, closed_by_profile_id, manager_override_profile_id, handed_over_to_bag_id",
    )
    .eq("restaurant_id", restaurantId)
    .eq("staff_profile_id", staffProfileId)
    .eq("status", "open")
    .maybeSingle();

  return (data as WaiterCashBagRow | null) ?? null;
}

async function findBagByIdempotencyKey(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  idempotencyKey: string,
): Promise<string | null> {
  const { data } = await admin
    .from("pos_waiter_cash_bag_movements")
    .select("cash_bag_id")
    .eq("restaurant_id", restaurantId)
    .eq("idempotency_key", idempotencyKey)
    .maybeSingle();

  return (data?.cash_bag_id as string | undefined) ?? null;
}

async function loadDiffThresholdCents(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
): Promise<number> {
  const { data } = await admin
    .from("pos_restaurant_fiscal_config")
    .select("waiter_cash_bag_diff_threshold_cents")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  const threshold = Number(data?.waiter_cash_bag_diff_threshold_cents ?? 500);
  return Number.isFinite(threshold) && threshold >= 0 ? threshold : 500;
}

export async function issueWaiterCashBag(params: {
  restaurantId: string;
  staffProfileId: string;
  openingFloatCents: number;
  issuedByProfileId: string;
  idempotencyKey: string;
}): Promise<{ ok: true; bagId: string } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const openingFloatCents = Math.max(0, Math.round(params.openingFloatCents));
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey) {
    return { ok: false, error: "idempotency_key_required", status: 400 };
  }

  const existingBagId = await findBagByIdempotencyKey(
    admin,
    params.restaurantId,
    idempotencyKey,
  );
  if (existingBagId) {
    return { ok: true, bagId: existingBagId };
  }

  const session = await getOpenRegisterSession(params.restaurantId);
  if (!session) {
    return { ok: false, error: "register_not_open", status: 409 };
  }

  const existingOpenBag = await findOpenBagForStaff(
    admin,
    params.restaurantId,
    params.staffProfileId,
  );
  if (existingOpenBag) {
    return { ok: false, error: "staff_already_has_open_bag", status: 409 };
  }

  const { data: bag, error: bagError } = await admin
    .from("pos_waiter_cash_bags")
    .insert({
      restaurant_id: params.restaurantId,
      register_session_id: session.id,
      staff_profile_id: params.staffProfileId,
      status: "open",
      opening_float_cents: openingFloatCents,
      opened_by_profile_id: params.issuedByProfileId,
    })
    .select("id")
    .single();

  if (bagError || !bag) {
    if (bagError?.code === "23505") {
      return { ok: false, error: "staff_already_has_open_bag", status: 409 };
    }
    return { ok: false, error: bagError?.message ?? "bag_insert_failed", status: 500 };
  }

  const { error: movementError } = await admin
    .from("pos_waiter_cash_bag_movements")
    .insert({
      restaurant_id: params.restaurantId,
      cash_bag_id: bag.id,
      register_session_id: session.id,
      kind: "float_out",
      amount_cents: openingFloatCents,
      idempotency_key: idempotencyKey,
      created_by_profile_id: params.issuedByProfileId,
    });

  if (movementError) {
    if (movementError.code === "23505") {
      const replayBagId = await findBagByIdempotencyKey(
        admin,
        params.restaurantId,
        idempotencyKey,
      );
      if (replayBagId) {
        return { ok: true, bagId: replayBagId };
      }
    }
    await admin.from("pos_waiter_cash_bags").delete().eq("id", bag.id);
    return { ok: false, error: movementError.message, status: 500 };
  }

  return { ok: true, bagId: bag.id as string };
}

export async function closeWaiterCashBag(params: {
  restaurantId: string;
  bagId: string;
  closingCountCents: number;
  closedByProfileId: string;
  managerOverrideProfileId?: string | null;
  managerPinVerified: boolean;
}): Promise<
  { ok: true; differenceCents: number } | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const closingCountCents = Math.max(0, Math.round(params.closingCountCents));

  const { data: bag, error: bagError } = await admin
    .from("pos_waiter_cash_bags")
    .select(
      "id, restaurant_id, register_session_id, staff_profile_id, status, opening_float_cents",
    )
    .eq("id", params.bagId)
    .eq("restaurant_id", params.restaurantId)
    .maybeSingle();

  if (bagError || !bag) {
    return { ok: false, error: "bag_not_found", status: 404 };
  }
  if (bag.status !== "open") {
    return { ok: false, error: "bag_not_open", status: 409 };
  }

  const movements = await loadBagMovements(admin, bag.id as string);
  const expectedCents = bagExpectedCents({
    openingFloatCents: Number(bag.opening_float_cents),
    movements,
  });
  const differenceCents = closingCountCents - expectedCents;

  const thresholdCents = await loadDiffThresholdCents(admin, params.restaurantId);
  if (Math.abs(differenceCents) >= thresholdCents && !params.managerPinVerified) {
    return { ok: false, error: "manager_pin_required", status: 403 };
  }

  const { data: closeMovement, error: movementError } = await admin
    .from("pos_waiter_cash_bag_movements")
    .insert({
      restaurant_id: params.restaurantId,
      cash_bag_id: bag.id,
      register_session_id: bag.register_session_id,
      kind: "close_count",
      amount_cents: closingCountCents,
      created_by_profile_id: params.closedByProfileId,
    })
    .select("id")
    .single();

  if (movementError || !closeMovement) {
    return { ok: false, error: movementError?.message ?? "movement_insert_failed", status: 500 };
  }

  const closedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("pos_waiter_cash_bags")
    .update({
      status: "closed",
      closing_count_cents: closingCountCents,
      difference_cents: differenceCents,
      closed_at: closedAt,
      closed_by_profile_id: params.closedByProfileId,
      manager_override_profile_id:
        Math.abs(differenceCents) >= thresholdCents
          ? (params.managerOverrideProfileId ?? null)
          : null,
    })
    .eq("id", bag.id);

  if (updateError) {
    await admin
      .from("pos_waiter_cash_bag_movements")
      .delete()
      .eq("id", closeMovement.id);
    return { ok: false, error: updateError.message, status: 500 };
  }

  return { ok: true, differenceCents };
}

export async function applyCashSaleToOpenBag(params: {
  restaurantId: string;
  cashierProfileId: string;
  paymentId: string;
  amountCents: number;
  idempotencyKey: string;
}): Promise<{ ok: true; bagId: string } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const amountCents = Math.max(0, Math.round(params.amountCents));
  const idempotencyKey = params.idempotencyKey.trim();
  if (!idempotencyKey) {
    return { ok: false, error: "idempotency_key_required", status: 400 };
  }

  const existingBagId = await findBagByIdempotencyKey(
    admin,
    params.restaurantId,
    idempotencyKey,
  );
  if (existingBagId) {
    return { ok: true, bagId: existingBagId };
  }

  const openBag = await findOpenBagForStaff(
    admin,
    params.restaurantId,
    params.cashierProfileId,
  );
  if (!openBag) {
    return { ok: false, error: "no_open_bag", status: 409 };
  }

  const { data: movement, error: movementError } = await admin
    .from("pos_waiter_cash_bag_movements")
    .insert({
      restaurant_id: params.restaurantId,
      cash_bag_id: openBag.id,
      register_session_id: openBag.register_session_id,
      kind: "cash_sale",
      amount_cents: amountCents,
      payment_id: params.paymentId,
      idempotency_key: idempotencyKey,
      created_by_profile_id: params.cashierProfileId,
    })
    .select("id")
    .single();

  if (movementError) {
    if (movementError.code === "23505") {
      const replayBagId = await findBagByIdempotencyKey(
        admin,
        params.restaurantId,
        idempotencyKey,
      );
      if (replayBagId) {
        return { ok: true, bagId: replayBagId };
      }
    }
    return { ok: false, error: movementError.message, status: 500 };
  }
  if (!movement) {
    return { ok: false, error: "movement_insert_failed", status: 500 };
  }

  const { error: paymentError } = await admin
    .from("pos_payments")
    .update({
      cashier_profile_id: params.cashierProfileId,
      cash_bag_id: openBag.id,
    })
    .eq("id", params.paymentId)
    .eq("restaurant_id", params.restaurantId);

  if (paymentError) {
    await admin.from("pos_waiter_cash_bag_movements").delete().eq("id", movement.id);
    return { ok: false, error: paymentError.message, status: 500 };
  }

  return { ok: true, bagId: openBag.id };
}

export async function listOpenWaiterCashBags(params: {
  restaurantId: string;
}): Promise<
  | {
      ok: true;
      bags: Array<{
        id: string;
        staffProfileId: string;
        registerSessionId: string;
        openingFloatCents: number;
        openedAt: string;
        expectedCents: number;
      }>;
    }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  const { data, error } = await admin
    .from("pos_waiter_cash_bags")
    .select(
      "id, staff_profile_id, register_session_id, opening_float_cents, opened_at",
    )
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "open")
    .order("opened_at", { ascending: true });

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  const bags = [];
  for (const row of data ?? []) {
    const movements = await loadBagMovements(admin, row.id as string);
    bags.push({
      id: row.id as string,
      staffProfileId: row.staff_profile_id as string,
      registerSessionId: row.register_session_id as string,
      openingFloatCents: Number(row.opening_float_cents),
      openedAt: row.opened_at as string,
      expectedCents: bagExpectedCents({
        openingFloatCents: Number(row.opening_float_cents),
        movements,
      }),
    });
  }

  return { ok: true, bags };
}

export async function handoverCashBag(params: {
  restaurantId: string;
  fromProfileId: string;
  toProfileId: string;
}): Promise<{ ok: true; toBagId: string } | { ok: false; error: string; status: number }> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable", status: 500 };

  if (params.fromProfileId === params.toProfileId) {
    return { ok: false, error: "same_staff", status: 400 };
  }

  const session = await getOpenRegisterSession(params.restaurantId);
  if (!session) {
    return { ok: false, error: "register_not_open", status: 409 };
  }

  const fromBag = await findOpenBagForStaff(
    admin,
    params.restaurantId,
    params.fromProfileId,
  );
  if (!fromBag) {
    return { ok: false, error: "from_bag_not_open", status: 404 };
  }
  if (fromBag.register_session_id !== session.id) {
    return { ok: false, error: "stale_bag_session", status: 409 };
  }

  const toOpenBag = await findOpenBagForStaff(
    admin,
    params.restaurantId,
    params.toProfileId,
  );
  if (toOpenBag) {
    return { ok: false, error: "to_already_has_open_bag", status: 409 };
  }

  const fromMovements = await loadBagMovements(admin, fromBag.id);
  const handoverAmountCents = bagExpectedCents({
    openingFloatCents: Number(fromBag.opening_float_cents),
    movements: fromMovements,
  });

  const { data: toBag, error: toBagError } = await admin
    .from("pos_waiter_cash_bags")
    .insert({
      restaurant_id: params.restaurantId,
      register_session_id: session.id,
      staff_profile_id: params.toProfileId,
      status: "open",
      opening_float_cents: handoverAmountCents,
      opened_by_profile_id: params.toProfileId,
    })
    .select("id")
    .single();

  if (toBagError || !toBag) {
    if (toBagError?.code === "23505") {
      return { ok: false, error: "to_already_has_open_bag", status: 409 };
    }
    return { ok: false, error: toBagError?.message ?? "bag_insert_failed", status: 500 };
  }

  const handedOverAt = new Date().toISOString();
  const { error: fromUpdateError } = await admin
    .from("pos_waiter_cash_bags")
    .update({
      status: "handed_over",
      closed_at: handedOverAt,
      handed_over_to_bag_id: toBag.id,
    })
    .eq("id", fromBag.id)
    .eq("status", "open");

  if (fromUpdateError) {
    await admin.from("pos_waiter_cash_bags").delete().eq("id", toBag.id);
    return { ok: false, error: fromUpdateError.message, status: 500 };
  }

  const movementRows = [
    {
      restaurant_id: params.restaurantId,
      cash_bag_id: fromBag.id,
      register_session_id: fromBag.register_session_id,
      kind: "handover",
      amount_cents: handoverAmountCents,
      created_by_profile_id: params.fromProfileId,
    },
    {
      restaurant_id: params.restaurantId,
      cash_bag_id: toBag.id,
      register_session_id: session.id,
      kind: "handover",
      amount_cents: handoverAmountCents,
      created_by_profile_id: params.toProfileId,
    },
  ];

  const { error: movementError } = await admin
    .from("pos_waiter_cash_bag_movements")
    .insert(movementRows);

  if (movementError) {
    await admin
      .from("pos_waiter_cash_bags")
      .update({ status: "open", closed_at: null, handed_over_to_bag_id: null })
      .eq("id", fromBag.id);
    await admin.from("pos_waiter_cash_bags").delete().eq("id", toBag.id);
    return { ok: false, error: movementError.message, status: 500 };
  }

  return { ok: true, toBagId: toBag.id as string };
}
