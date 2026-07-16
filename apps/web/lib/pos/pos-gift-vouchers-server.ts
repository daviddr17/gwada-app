import "server-only";

import { randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ensureAccountingCashBookDefaults,
  upsertAccountingCashEntry,
} from "@/lib/accounting/accounting-cash-book-server";
import { createAccountingVoucher } from "@/lib/accounting/accounting-vouchers-server";
import { getSystemPosPaymentMethod } from "@/lib/pos/pos-payment-methods-server";
import { runPosPaymentPipelineForPayment } from "@/lib/pos/pos-payment-pipeline";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type {
  PosGiftVoucherListStats,
  PosGiftVoucherPrintFormat,
  PosGiftVoucherRow,
  PosGiftVoucherSettings,
} from "@/lib/types/pos-gift-vouchers";
import {
  buildPosGiftVoucherQrPayload,
  parsePosGiftVoucherQrPayload,
} from "@/lib/types/pos-gift-vouchers";

const DEFAULT_VALIDITY_MONTHS = 36;

function mapVoucher(row: Record<string, unknown>): PosGiftVoucherRow {
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    code: String(row.code),
    public_token: String(row.public_token),
    initial_amount_cents: Number(row.initial_amount_cents),
    balance_cents: Number(row.balance_cents),
    currency: String(row.currency ?? "EUR"),
    status: row.status as PosGiftVoucherRow["status"],
    validity_months_at_issue: Number(row.validity_months_at_issue),
    issued_at: String(row.issued_at),
    expires_at: String(row.expires_at),
    voided_at: (row.voided_at as string | null) ?? null,
    expired_at: (row.expired_at as string | null) ?? null,
    issued_by_profile_id: (row.issued_by_profile_id as string | null) ?? null,
    voided_by_profile_id: (row.voided_by_profile_id as string | null) ?? null,
    issue_payment_method: String(row.issue_payment_method ?? "cash"),
    issue_order_id: (row.issue_order_id as string | null) ?? null,
    issue_payment_id: (row.issue_payment_id as string | null) ?? null,
    issue_cash_entry_id: (row.issue_cash_entry_id as string | null) ?? null,
    void_cash_entry_id: (row.void_cash_entry_id as string | null) ?? null,
    expire_accounting_voucher_id:
      (row.expire_accounting_voucher_id as string | null) ?? null,
    last_printed_at: (row.last_printed_at as string | null) ?? null,
    note: (row.note as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function addMonthsUtc(iso: string | Date, months: number): Date {
  const d = new Date(iso);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() < day) {
    d.setUTCDate(0);
  }
  return d;
}

function generatePublicToken(): string {
  return randomBytes(18).toString("base64url");
}

function generateVoucherCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    out += alphabet[bytes[i]! % alphabet.length];
  }
  return `GV-${out.slice(0, 4)}-${out.slice(4)}`;
}

async function findIncomeCategoryId(
  sb: SupabaseClient,
  restaurantId: string,
  name: string,
): Promise<string | null> {
  const { data } = await sb
    .from("accounting_cash_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("direction", "income")
    .eq("archived", false)
    .ilike("name", name)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function findExpenseCategoryId(
  sb: SupabaseClient,
  restaurantId: string,
  name: string,
): Promise<string | null> {
  const { data } = await sb
    .from("accounting_cash_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("direction", "expense")
    .eq("archived", false)
    .ilike("name", name)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function ensureGiftCashCategories(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<void> {
  await ensureAccountingCashBookDefaults(sb, restaurantId);
  const needed: Array<{ direction: "income" | "expense"; name: string; sort_order: number }> = [
    { direction: "income", name: "Gutscheinverkauf", sort_order: 3 },
    { direction: "expense", name: "Gutschein-Storno", sort_order: 3 },
    { direction: "income", name: "Gutscheinverfall", sort_order: 4 },
  ];
  for (const row of needed) {
    const { data } = await sb
      .from("accounting_cash_categories")
      .select("id")
      .eq("restaurant_id", restaurantId)
      .eq("direction", row.direction)
      .ilike("name", row.name)
      .maybeSingle();
    if (!data) {
      await sb.from("accounting_cash_categories").insert({
        restaurant_id: restaurantId,
        direction: row.direction,
        name: row.name,
        sort_order: row.sort_order,
        archived: false,
      });
    }
  }
}

async function recordEvent(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    giftVoucherId: string;
    eventType: "issued" | "redeemed" | "voided" | "expired" | "reprinted";
    amountCents: number;
    balanceAfterCents: number;
    posPaymentId?: string | null;
    cashEntryId?: string | null;
    accountingVoucherId?: string | null;
    actorProfileId?: string | null;
    note?: string | null;
  },
): Promise<void> {
  await sb.from("pos_gift_voucher_events").insert({
    restaurant_id: params.restaurantId,
    gift_voucher_id: params.giftVoucherId,
    event_type: params.eventType,
    amount_cents: params.amountCents,
    balance_after_cents: params.balanceAfterCents,
    pos_payment_id: params.posPaymentId ?? null,
    cash_entry_id: params.cashEntryId ?? null,
    accounting_voucher_id: params.accountingVoucherId ?? null,
    actor_profile_id: params.actorProfileId ?? null,
    note: params.note ?? null,
  });
}

export async function getPosGiftVoucherSettings(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<PosGiftVoucherSettings> {
  const { data } = await sb
    .from("pos_gift_voucher_settings")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .maybeSingle();

  if (data) {
    return {
      restaurant_id: restaurantId,
      default_validity_months: Number(data.default_validity_months),
      voucher_printer_id: (data.voucher_printer_id as string | null) ?? null,
      print_format: (data.print_format as PosGiftVoucherPrintFormat) ?? "both",
    };
  }

  const { data: inserted } = await sb
    .from("pos_gift_voucher_settings")
    .upsert({
      restaurant_id: restaurantId,
      default_validity_months: DEFAULT_VALIDITY_MONTHS,
      print_format: "both",
    })
    .select("*")
    .single();

  return {
    restaurant_id: restaurantId,
    default_validity_months: Number(
      inserted?.default_validity_months ?? DEFAULT_VALIDITY_MONTHS,
    ),
    voucher_printer_id: (inserted?.voucher_printer_id as string | null) ?? null,
    print_format: (inserted?.print_format as PosGiftVoucherPrintFormat) ?? "both",
  };
}

export async function updatePosGiftVoucherSettings(
  sb: SupabaseClient,
  restaurantId: string,
  patch: Partial<{
    default_validity_months: number;
    voucher_printer_id: string | null;
    print_format: PosGiftVoucherPrintFormat;
  }>,
): Promise<{ settings: PosGiftVoucherSettings | null; error?: string }> {
  const current = await getPosGiftVoucherSettings(sb, restaurantId);
  const next = {
    restaurant_id: restaurantId,
    default_validity_months:
      patch.default_validity_months ?? current.default_validity_months,
    voucher_printer_id:
      patch.voucher_printer_id === undefined
        ? current.voucher_printer_id
        : patch.voucher_printer_id,
    print_format: patch.print_format ?? current.print_format,
  };

  if (
    next.default_validity_months < 1 ||
    next.default_validity_months > 120
  ) {
    return { settings: null, error: "invalid_validity_months" };
  }

  const { data, error } = await sb
    .from("pos_gift_voucher_settings")
    .upsert(next)
    .select("*")
    .single();

  if (error || !data) {
    return { settings: null, error: error?.message ?? "settings_save_failed" };
  }

  return {
    settings: {
      restaurant_id: restaurantId,
      default_validity_months: Number(data.default_validity_months),
      voucher_printer_id: (data.voucher_printer_id as string | null) ?? null,
      print_format: (data.print_format as PosGiftVoucherPrintFormat) ?? "both",
    },
  };
}

export async function listPosGiftVouchers(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { status?: string | null; search?: string | null; limit?: number },
): Promise<PosGiftVoucherRow[]> {
  await expireDueGiftVouchers(sb, restaurantId);

  let query = sb
    .from("pos_gift_vouchers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .order("issued_at", { ascending: false })
    .limit(opts?.limit ?? 200);

  if (opts?.status?.trim()) {
    query = query.eq("status", opts.status.trim());
  }
  if (opts?.search?.trim()) {
    const q = opts.search.trim();
    query = query.or(`code.ilike.%${q}%,public_token.ilike.%${q}%`);
  }

  const { data } = await query;
  return (data ?? []).map((row) => mapVoucher(row as Record<string, unknown>));
}

export async function getPosGiftVoucherStats(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<PosGiftVoucherListStats> {
  await expireDueGiftVouchers(sb, restaurantId);

  const { data } = await sb
    .from("pos_gift_vouchers")
    .select("status, balance_cents, initial_amount_cents")
    .eq("restaurant_id", restaurantId)
    .limit(5000);

  let activeCount = 0;
  let activeBalanceCents = 0;
  let redeemedCount = 0;
  let voidedCount = 0;
  let expiredCount = 0;
  let issuedCentsInPeriod = 0;
  let redeemedCentsInPeriod = 0;

  for (const row of data ?? []) {
    const status = String(row.status);
    const balance = Number(row.balance_cents);
    const initial = Number(row.initial_amount_cents);
    issuedCentsInPeriod += initial;
    redeemedCentsInPeriod += Math.max(0, initial - balance);
    if (status === "active") {
      activeCount += 1;
      activeBalanceCents += balance;
    } else if (status === "redeemed") redeemedCount += 1;
    else if (status === "voided") voidedCount += 1;
    else if (status === "expired") expiredCount += 1;
  }

  return {
    activeCount,
    activeBalanceCents,
    redeemedCount,
    voidedCount,
    expiredCount,
    issuedCentsInPeriod,
    redeemedCentsInPeriod,
  };
}

export async function getPosGiftVoucherById(
  sb: SupabaseClient,
  restaurantId: string,
  voucherId: string,
): Promise<PosGiftVoucherRow | null> {
  const { data } = await sb
    .from("pos_gift_vouchers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("id", voucherId)
    .maybeSingle();
  return data ? mapVoucher(data as Record<string, unknown>) : null;
}

/** Lookup per Code, Token oder QR-Payload. Löst fällige Verfälle aus. */
export async function lookupPosGiftVoucher(
  sb: SupabaseClient,
  restaurantId: string,
  raw: string,
): Promise<
  | { ok: true; voucher: PosGiftVoucherRow }
  | { ok: false; error: string; status: number }
> {
  await expireDueGiftVouchers(sb, restaurantId);

  const parsed = parsePosGiftVoucherQrPayload(raw) ?? raw.trim();
  if (!parsed) {
    return { ok: false, error: "invalid_code", status: 400 };
  }

  let query = sb
    .from("pos_gift_vouchers")
    .select("*")
    .eq("restaurant_id", restaurantId);

  if (parsed.startsWith("GV-")) {
    query = query.ilike("code", parsed);
  } else {
    query = query.or(`public_token.eq.${parsed},code.ilike.${parsed}`);
  }

  const { data } = await query.maybeSingle();
  if (!data) {
    return { ok: false, error: "voucher_not_found", status: 404 };
  }

  const voucher = mapVoucher(data as Record<string, unknown>);
  if (voucher.status === "voided") {
    return { ok: false, error: "voucher_voided", status: 400 };
  }
  if (voucher.status === "expired") {
    return { ok: false, error: "voucher_expired", status: 400 };
  }
  if (voucher.status === "redeemed" || voucher.balance_cents <= 0) {
    return { ok: false, error: "voucher_empty", status: 400 };
  }

  return { ok: true, voucher };
}

export function giftVoucherQrPayload(voucher: PosGiftVoucherRow): string {
  return buildPosGiftVoucherQrPayload(voucher.public_token);
}

/**
 * Wertgutschein ausstellen (Bar): Kassenbuch 0 %, TSE-Bon (0 % MwSt), Guthaben aktiv.
 */
export async function issuePosGiftVoucher(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  amountCents: number;
  actorProfileId?: string | null;
  note?: string | null;
  validityMonths?: number | null;
}): Promise<
  | { ok: true; voucher: PosGiftVoucherRow }
  | { ok: false; error: string; status: number }
> {
  const amountCents = Math.round(params.amountCents);
  if (!Number.isFinite(amountCents) || amountCents < 100) {
    return { ok: false, error: "invalid_amount", status: 400 };
  }
  if (amountCents > 5_000_00) {
    return { ok: false, error: "amount_too_large", status: 400 };
  }

  const admin = createSupabaseAdminClient() ?? params.supabase;
  const settings = await getPosGiftVoucherSettings(admin, params.restaurantId);
  const validityMonths =
    params.validityMonths && params.validityMonths >= 1
      ? Math.min(120, Math.round(params.validityMonths))
      : settings.default_validity_months;

  const issuedAt = new Date();
  const expiresAt = addMonthsUtc(issuedAt, validityMonths);

  let code = generateVoucherCode();
  let publicToken = generatePublicToken();

  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: clash } = await admin
      .from("pos_gift_vouchers")
      .select("id")
      .eq("restaurant_id", params.restaurantId)
      .ilike("code", code)
      .maybeSingle();
    if (!clash) break;
    code = generateVoucherCode();
    publicToken = generatePublicToken();
  }

  const { data: voucherInsert, error: voucherError } = await admin
    .from("pos_gift_vouchers")
    .insert({
      restaurant_id: params.restaurantId,
      code,
      public_token: publicToken,
      initial_amount_cents: amountCents,
      balance_cents: amountCents,
      status: "active",
      validity_months_at_issue: validityMonths,
      issued_at: issuedAt.toISOString(),
      expires_at: expiresAt.toISOString(),
      issued_by_profile_id: params.actorProfileId ?? null,
      issue_payment_method: "cash",
      note: params.note?.trim() || null,
    })
    .select("*")
    .single();

  if (voucherError || !voucherInsert) {
    console.warn("[pos] gift voucher insert", voucherError?.message);
    return { ok: false, error: "voucher_create_failed", status: 500 };
  }

  const voucherId = voucherInsert.id as string;

  const { data: order, error: orderError } = await admin
    .from("pos_orders")
    .insert({
      restaurant_id: params.restaurantId,
      table_session_id: null,
      gift_voucher_id: voucherId,
      status: "pending_payment",
      currency: "EUR",
      subtotal_cents: amountCents,
      discount_cents: 0,
      tip_cents: 0,
      total_cents: amountCents,
      notes: `gift_voucher:${voucherId}`,
      created_by_profile_id: params.actorProfileId ?? null,
    })
    .select("id")
    .single();

  if (orderError || !order) {
    console.warn("[pos] gift voucher order", orderError?.message);
    await admin.from("pos_gift_vouchers").delete().eq("id", voucherId);
    return { ok: false, error: "order_create_failed", status: 500 };
  }

  const orderId = order.id as string;

  const { data: line, error: lineError } = await admin
    .from("pos_order_lines")
    .insert({
      order_id: orderId,
      menu_item_id: null,
      name: `Wertgutschein ${code}`,
      quantity: 1,
      unit_price_cents: amountCents,
      vat_rate: 0,
      line_total_cents: amountCents,
      position: 0,
      paid_quantity: 1,
      metadata: { gift_voucher_id: voucherId },
    })
    .select("id")
    .single();

  if (lineError || !line) {
    console.warn("[pos] gift voucher line", lineError?.message);
    await admin.from("pos_orders").delete().eq("id", orderId);
    await admin.from("pos_gift_vouchers").delete().eq("id", voucherId);
    return { ok: false, error: "line_create_failed", status: 500 };
  }

  const cashMethod = await getSystemPosPaymentMethod(
    admin,
    params.restaurantId,
    "cash",
  );

  const { data: payment, error: payError } = await admin
    .from("pos_payments")
    .insert({
      restaurant_id: params.restaurantId,
      order_id: orderId,
      amount_cents: amountCents,
      tip_cents: 0,
      received_amount_cents: amountCents,
      method: "cash",
      status: "paid",
      paid_at: issuedAt.toISOString(),
      gift_voucher_id: voucherId,
      restaurant_payment_method_id: cashMethod?.id ?? null,
    })
    .select("id")
    .single();

  if (payError || !payment) {
    console.warn("[pos] gift voucher payment", payError?.message);
    await admin.from("pos_orders").delete().eq("id", orderId);
    await admin.from("pos_gift_vouchers").delete().eq("id", voucherId);
    return { ok: false, error: "payment_create_failed", status: 500 };
  }

  const paymentId = payment.id as string;
  await admin
    .from("pos_payments")
    .update({ split_group: paymentId })
    .eq("id", paymentId);

  await admin.from("pos_payment_line_allocations").insert({
    payment_id: paymentId,
    order_line_id: line.id,
    quantity: 1,
    amount_cents: amountCents,
  });

  const pipeline = await runPosPaymentPipelineForPayment(paymentId);
  if (!pipeline.ok) {
    console.warn("[pos] gift voucher TSE pipeline", pipeline.error);
  }

  await ensureGiftCashCategories(admin, params.restaurantId);
  const catId = await findIncomeCategoryId(
    admin,
    params.restaurantId,
    "Gutscheinverkauf",
  );

  let cashEntryId: string | null = null;
  if (catId) {
    const created = await upsertAccountingCashEntry(
      admin,
      params.restaurantId,
      {
        entry_date: issuedAt.toISOString().slice(0, 10),
        direction: "income",
        category_id: catId,
        note: `Gutschein ${code} · Ausstellung`,
        tax_lines: [
          { amount: amountCents / 100, tax_rate_percent: 0 },
        ],
      },
    );
    cashEntryId = created.row?.id ?? null;
  }

  await admin
    .from("pos_gift_vouchers")
    .update({
      issue_order_id: orderId,
      issue_payment_id: paymentId,
      issue_cash_entry_id: cashEntryId,
    })
    .eq("id", voucherId);

  await recordEvent(admin, {
    restaurantId: params.restaurantId,
    giftVoucherId: voucherId,
    eventType: "issued",
    amountCents,
    balanceAfterCents: amountCents,
    posPaymentId: paymentId,
    cashEntryId,
    actorProfileId: params.actorProfileId,
    note: "Ausstellung (Bar)",
  });

  const voucher = await getPosGiftVoucherById(
    admin,
    params.restaurantId,
    voucherId,
  );
  if (!voucher) {
    return { ok: false, error: "voucher_load_failed", status: 500 };
  }

  return { ok: true, voucher };
}

export async function voidPosGiftVoucher(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  voucherId: string;
  actorProfileId?: string | null;
}): Promise<
  | { ok: true; voucher: PosGiftVoucherRow }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient() ?? params.supabase;
  const voucher = await getPosGiftVoucherById(
    admin,
    params.restaurantId,
    params.voucherId,
  );
  if (!voucher) {
    return { ok: false, error: "voucher_not_found", status: 404 };
  }
  if (voucher.status !== "active") {
    return { ok: false, error: "voucher_not_active", status: 400 };
  }
  if (voucher.balance_cents !== voucher.initial_amount_cents) {
    return { ok: false, error: "voucher_already_partially_redeemed", status: 400 };
  }

  const now = new Date();
  await ensureGiftCashCategories(admin, params.restaurantId);
  const catId = await findExpenseCategoryId(
    admin,
    params.restaurantId,
    "Gutschein-Storno",
  );

  let cashEntryId: string | null = null;
  if (catId && voucher.issue_payment_method === "cash") {
    const created = await upsertAccountingCashEntry(
      admin,
      params.restaurantId,
      {
        entry_date: now.toISOString().slice(0, 10),
        direction: "expense",
        category_id: catId,
        note: `Gutschein ${voucher.code} · Storno Ausstellung`,
        tax_lines: [
          {
            amount: voucher.balance_cents / 100,
            tax_rate_percent: 0,
          },
        ],
      },
    );
    cashEntryId = created.row?.id ?? null;
  }

  const { error } = await admin
    .from("pos_gift_vouchers")
    .update({
      status: "voided",
      balance_cents: 0,
      voided_at: now.toISOString(),
      voided_by_profile_id: params.actorProfileId ?? null,
      void_cash_entry_id: cashEntryId,
    })
    .eq("id", voucher.id)
    .eq("status", "active");

  if (error) {
    return { ok: false, error: error.message, status: 500 };
  }

  if (voucher.issue_payment_id) {
    await admin
      .from("pos_payments")
      .update({
        status: "refunded",
        refunded_at: now.toISOString(),
      })
      .eq("id", voucher.issue_payment_id)
      .eq("status", "paid");
  }

  await recordEvent(admin, {
    restaurantId: params.restaurantId,
    giftVoucherId: voucher.id,
    eventType: "voided",
    amountCents: voucher.balance_cents,
    balanceAfterCents: 0,
    cashEntryId,
    actorProfileId: params.actorProfileId,
    note: "Storno Ausstellung",
  });

  const updated = await getPosGiftVoucherById(
    admin,
    params.restaurantId,
    voucher.id,
  );
  if (!updated) {
    return { ok: false, error: "voucher_load_failed", status: 500 };
  }
  return { ok: true, voucher: updated };
}

export async function markPosGiftVoucherReprinted(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  voucherId: string;
  actorProfileId?: string | null;
}): Promise<void> {
  const now = new Date().toISOString();
  await params.supabase
    .from("pos_gift_vouchers")
    .update({ last_printed_at: now })
    .eq("restaurant_id", params.restaurantId)
    .eq("id", params.voucherId);

  const voucher = await getPosGiftVoucherById(
    params.supabase,
    params.restaurantId,
    params.voucherId,
  );
  if (!voucher) return;

  await recordEvent(params.supabase, {
    restaurantId: params.restaurantId,
    giftVoucherId: params.voucherId,
    eventType: "reprinted",
    amountCents: 0,
    balanceAfterCents: voucher.balance_cents,
    actorProfileId: params.actorProfileId,
    note: "Nachdruck",
  });
}

/**
 * Fällige Gutscheine auf expired setzen und Restguthaben als Ertrag (0 %) verbuchen
 * — ohne erneute Kassenbewegung (Bar war bei Ausstellung).
 */
export async function expireDueGiftVouchers(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<number> {
  const admin = createSupabaseAdminClient() ?? sb;
  const nowIso = new Date().toISOString();

  const { data: due } = await admin
    .from("pos_gift_vouchers")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("status", "active")
    .lt("expires_at", nowIso)
    .gt("balance_cents", 0)
    .limit(100);

  if (!due?.length) return 0;

  await ensureGiftCashCategories(admin, restaurantId);
  let count = 0;

  for (const row of due) {
    const voucher = mapVoucher(row as Record<string, unknown>);
    let accountingVoucherId: string | null = null;

    try {
      const actorUserId = voucher.issued_by_profile_id;
      if (actorUserId && voucher.balance_cents > 0) {
        const created = await createAccountingVoucher(admin, {
          restaurantId,
          userId: actorUserId,
          input: {
            voucherKind: "sales",
            voucherDate: nowIso.slice(0, 10),
            taxMode: "gross",
            useCollectiveContact: true,
            contactName: "Gutscheinverfall",
            voucherNumber: voucher.code,
            remark: `Verfall Wertgutschein ${voucher.code}`,
            voucherItems: [
              {
                id: crypto.randomUUID(),
                sortOrder: 0,
                label: `Gutscheinverfall ${voucher.code}`,
                amount: voucher.balance_cents / 100,
                taxAmount: 0,
                taxRatePercent: 0,
                categoryLabel: "Gutscheinverfall",
              },
            ],
            syncToLexoffice: false,
            status: "open",
          },
        });
        accountingVoucherId = created.row?.id ?? null;
      }
    } catch (e) {
      console.warn(
        "[pos] gift voucher expire accounting",
        e instanceof Error ? e.message : e,
      );
    }

    const { error } = await admin
      .from("pos_gift_vouchers")
      .update({
        status: "expired",
        balance_cents: 0,
        expired_at: nowIso,
        expire_accounting_voucher_id: accountingVoucherId,
      })
      .eq("id", voucher.id)
      .eq("status", "active");

    if (error) continue;

    await recordEvent(admin, {
      restaurantId,
      giftVoucherId: voucher.id,
      eventType: "expired",
      amountCents: voucher.balance_cents,
      balanceAfterCents: 0,
      accountingVoucherId,
      note: "Verfall Restguthaben",
    });
    count += 1;
  }

  return count;
}

/**
 * Guthaben nach erfolgreicher POS-Zahlung (method=voucher) reduzieren.
 */
export async function applyGiftVoucherRedemption(params: {
  supabase: SupabaseClient;
  restaurantId: string;
  voucherId: string;
  amountCents: number;
  paymentId: string;
  actorProfileId?: string | null;
}): Promise<
  | { ok: true; voucher: PosGiftVoucherRow; remainingCents: number }
  | { ok: false; error: string; status: number }
> {
  const admin = createSupabaseAdminClient() ?? params.supabase;
  await expireDueGiftVouchers(admin, params.restaurantId);

  const amountCents = Math.round(params.amountCents);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    return { ok: false, error: "invalid_amount", status: 400 };
  }

  const voucher = await getPosGiftVoucherById(
    admin,
    params.restaurantId,
    params.voucherId,
  );
  if (!voucher) {
    return { ok: false, error: "voucher_not_found", status: 404 };
  }
  if (voucher.status !== "active") {
    return { ok: false, error: "voucher_not_active", status: 400 };
  }
  if (amountCents > voucher.balance_cents) {
    return { ok: false, error: "amount_exceeds_balance", status: 400 };
  }

  const nextBalance = voucher.balance_cents - amountCents;
  const nextStatus = nextBalance <= 0 ? "redeemed" : "active";

  const { error } = await admin
    .from("pos_gift_vouchers")
    .update({
      balance_cents: nextBalance,
      status: nextStatus,
    })
    .eq("id", voucher.id)
    .eq("status", "active")
    .eq("balance_cents", voucher.balance_cents);

  if (error) {
    return { ok: false, error: "concurrent_update", status: 409 };
  }

  await recordEvent(admin, {
    restaurantId: params.restaurantId,
    giftVoucherId: voucher.id,
    eventType: "redeemed",
    amountCents,
    balanceAfterCents: nextBalance,
    posPaymentId: params.paymentId,
    actorProfileId: params.actorProfileId,
    note: "Einlösung",
  });

  const updated = await getPosGiftVoucherById(
    admin,
    params.restaurantId,
    voucher.id,
  );
  if (!updated) {
    return { ok: false, error: "voucher_load_failed", status: 500 };
  }

  return {
    ok: true,
    voucher: updated,
    remainingCents: updated.balance_cents,
  };
}
