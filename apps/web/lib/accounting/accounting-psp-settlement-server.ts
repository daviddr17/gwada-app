import "server-only";

import {
  ensureAccountingCashBookDefaults,
  upsertAccountingCashEntry,
} from "@/lib/accounting/accounting-cash-book-server";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { createAccountingVoucher } from "@/lib/accounting/accounting-vouchers-server";
import type { AccountingVoucherItem } from "@/lib/types/accounting";
import type {
  AccountingPspProvider,
  PosZAutopilotStep,
} from "@/lib/types/accounting-pos-z-autopilot";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

function centsToEuro(cents: number): number {
  return Math.round(cents) / 100;
}

function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

async function findExpenseCategoryId(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  name: string,
): Promise<string | null> {
  const { data } = await admin
    .from("accounting_cash_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("direction", "expense")
    .eq("archived", false)
    .ilike("name", name)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function ensurePaymentFeeCategory(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
): Promise<string | null> {
  await ensureAccountingCashBookDefaults(admin, restaurantId);
  const existing = await findExpenseCategoryId(
    admin,
    restaurantId,
    "Payment-Gebühren",
  );
  if (existing) return existing;

  const { data, error } = await admin
    .from("accounting_cash_categories")
    .insert({
      restaurant_id: restaurantId,
      direction: "expense",
      name: "Payment-Gebühren",
      sort_order: 3,
    })
    .select("id")
    .single();
  if (error || !data) return null;
  return data.id as string;
}

/**
 * Bucht Payment-Gebühren aus einer PSP-Abrechnung
 * (z. B. 1.200 € Unbar / 10 € Gebühr → 1.190 € Netto).
 * Aktualisiert optional den Autopilot-Schritt `psp_fees` der Kassensitzung.
 */
export async function bookPspSettlementFees(input: {
  restaurantId: string;
  actorUserId: string;
  provider: AccountingPspProvider;
  externalSettlementId: string;
  settlementDate: string;
  grossCents: number;
  feeCents: number;
  currency?: string;
  posRegisterSessionId?: string | null;
  raw?: Record<string, unknown> | null;
}): Promise<
  | {
      ok: true;
      settlementId: string;
      feeVoucherId: string | null;
      feeCashEntryId: string | null;
    }
  | { ok: false; error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const currency = (input.currency ?? "EUR").trim().toUpperCase() || "EUR";
  const grossCents = Math.max(0, Math.round(input.grossCents));
  const feeCents = Math.max(0, Math.round(input.feeCents));
  const netCents = Math.max(0, grossCents - feeCents);
  const externalSettlementId = input.externalSettlementId.trim();
  if (!externalSettlementId) {
    return { ok: false, error: "Abrechnungs-Referenz fehlt." };
  }
  if (feeCents <= 0) {
    return { ok: false, error: "Keine Gebühren zu buchen." };
  }

  const { data: existing } = await admin
    .from("accounting_psp_settlements")
    .select("id, fee_voucher_id, fee_cash_entry_id, status")
    .eq("restaurant_id", input.restaurantId)
    .eq("provider", input.provider)
    .eq("external_settlement_id", externalSettlementId)
    .maybeSingle();

  if (existing?.status === "booked") {
    return {
      ok: true,
      settlementId: existing.id as string,
      feeVoucherId: (existing.fee_voucher_id as string | null) ?? null,
      feeCashEntryId: (existing.fee_cash_entry_id as string | null) ?? null,
    };
  }

  const settings = await getAccountingSettings(admin, input.restaurantId);
  const pushLex = settings.push_pos_z_to_lexoffice === true;
  const importCash = settings.import_pos_z_to_cash_book === true;

  let feeVoucherId: string | null =
    (existing?.fee_voucher_id as string | null) ?? null;
  let feeCashEntryId: string | null =
    (existing?.fee_cash_entry_id as string | null) ?? null;

  try {
    const bookingEnabled = pushLex || importCash;

    if (pushLex && !feeVoucherId) {
      const voucherItems: AccountingVoucherItem[] = [
        {
          id: crypto.randomUUID(),
          sortOrder: 0,
          label: `Payment-Gebühren (${input.provider})`,
          amount: centsToEuro(feeCents),
          taxAmount: 0,
          taxRatePercent: 0,
          categoryLabel: "Payment-Gebühren",
        },
      ];
      const created = await createAccountingVoucher(admin, {
        restaurantId: input.restaurantId,
        userId: input.actorUserId,
        input: {
          voucherKind: "expense",
          voucherDate: input.settlementDate,
          taxMode: "gross",
          useCollectiveContact: true,
          contactName: `PSP ${input.provider}`,
          voucherNumber: `PSP-${input.provider}-${externalSettlementId}`.slice(
            0,
            80,
          ),
          remark: `Payment-Gebühren · Brutto ${formatEuroFromCents(grossCents)} · Netto ${formatEuroFromCents(netCents)} ${currency}`,
          voucherItems,
          syncToLexoffice: true,
          status: "open",
        },
      });
      if (!created.row) {
        throw new Error(created.error ?? "fee_voucher_failed");
      }
      feeVoucherId = created.row.id;
    }

    if (importCash && !feeCashEntryId) {
      const catId = await ensurePaymentFeeCategory(admin, input.restaurantId);
      if (!catId) throw new Error("fee_category_missing");
      const created = await upsertAccountingCashEntry(
        admin,
        input.restaurantId,
        {
          entry_date: input.settlementDate,
          direction: "expense",
          category_id: catId,
          note: `Payment-Gebühren ${input.provider} (${externalSettlementId}) · Brutto ${formatEuroFromCents(grossCents)} → Netto ${formatEuroFromCents(netCents)}`,
          tax_lines: [
            { amount: centsToEuro(feeCents), tax_rate_percent: 0 },
          ],
          voucher_id: feeVoucherId,
        },
      );
      if (!created.row) {
        throw new Error(created.error ?? "fee_cash_entry_failed");
      }
      feeCashEntryId = created.row.id;
    }

    const settlementStatus = bookingEnabled ? "booked" : "skipped";

    const { data: row, error } = await admin
      .from("accounting_psp_settlements")
      .upsert(
        {
          restaurant_id: input.restaurantId,
          provider: input.provider,
          external_settlement_id: externalSettlementId,
          settlement_date: input.settlementDate,
          currency,
          gross_cents: grossCents,
          fee_cents: feeCents,
          net_cents: netCents,
          pos_register_session_id: input.posRegisterSessionId ?? null,
          fee_voucher_id: feeVoucherId,
          fee_cash_entry_id: feeCashEntryId,
          status: settlementStatus,
          last_error: null,
          raw: input.raw ?? {},
        },
        { onConflict: "restaurant_id,provider,external_settlement_id" },
      )
      .select("id")
      .single();

    if (error || !row) {
      throw new Error(error?.message ?? "settlement_upsert_failed");
    }

    if (input.posRegisterSessionId && bookingEnabled) {
      await markAutopilotPspFeesOk({
        admin,
        restaurantId: input.restaurantId,
        sessionId: input.posRegisterSessionId,
        feeCents,
        feeVoucherId,
      });
    }

    return {
      ok: true,
      settlementId: row.id as string,
      feeVoucherId,
      feeCashEntryId,
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : "psp_settlement_failed";
    await admin.from("accounting_psp_settlements").upsert(
      {
        restaurant_id: input.restaurantId,
        provider: input.provider,
        external_settlement_id: externalSettlementId,
        settlement_date: input.settlementDate,
        currency,
        gross_cents: grossCents,
        fee_cents: feeCents,
        net_cents: netCents,
        pos_register_session_id: input.posRegisterSessionId ?? null,
        fee_voucher_id: feeVoucherId,
        fee_cash_entry_id: feeCashEntryId,
        status: "error",
        last_error: message,
        raw: input.raw ?? {},
      },
      { onConflict: "restaurant_id,provider,external_settlement_id" },
    );
    return { ok: false, error: message };
  }
}

async function markAutopilotPspFeesOk(params: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  restaurantId: string;
  sessionId: string;
  feeCents: number;
  feeVoucherId: string | null;
}): Promise<void> {
  const { data } = await params.admin
    .from("accounting_pos_z_imports")
    .select("id, steps, status")
    .eq("restaurant_id", params.restaurantId)
    .eq("pos_register_session_id", params.sessionId)
    .maybeSingle();
  if (!data) return;

  const steps = Array.isArray(data.steps)
    ? ([...(data.steps as PosZAutopilotStep[])] as PosZAutopilotStep[])
    : [];
  const nextStep: PosZAutopilotStep = {
    key: "psp_fees",
    label: "PSP-Gebühren",
    status: "ok",
    detail: params.feeVoucherId
      ? `${formatEuroFromCents(params.feeCents)} gebucht`
      : `${formatEuroFromCents(params.feeCents)} (ohne Lexoffice)`,
    error: null,
  };
  const idx = steps.findIndex((s) => s.key === "psp_fees");
  if (idx >= 0) steps[idx] = nextStep;
  else steps.push(nextStep);

  const unbarIdx = steps.findIndex((s) => s.key === "unbar");
  if (unbarIdx >= 0 && steps[unbarIdx]?.status === "waiting") {
    steps[unbarIdx] = {
      ...steps[unbarIdx]!,
      status: "ok",
      detail: steps[unbarIdx]!.detail ?? "Mit Settlement abgeglichen",
      error: null,
    };
  }

  const actionable = steps.filter((s) => s.status !== "waiting");
  let status = data.status as string;
  if (actionable.every((s) => s.status === "ok" || s.status === "skipped")) {
    status = "ok";
  } else if (actionable.some((s) => s.status === "error")) {
    status = actionable.some((s) => s.status === "ok") ? "partial" : "error";
  }

  await params.admin
    .from("accounting_pos_z_imports")
    .update({
      fee_cents: params.feeCents,
      fee_voucher_id: params.feeVoucherId,
      steps,
      status,
      completed_at:
        status === "ok" || status === "partial" || status === "error"
          ? new Date().toISOString()
          : null,
    })
    .eq("id", data.id);
}
