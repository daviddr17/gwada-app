import "server-only";

import {
  ensureAccountingCashBookDefaults,
  upsertAccountingCashEntry,
} from "@/lib/accounting/accounting-cash-book-server";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { createAccountingVoucher } from "@/lib/accounting/accounting-vouchers-server";
import {
  getRegisterSessionById,
  loadRegisterSessionAggregate,
} from "@/lib/pos/register-report-aggregate";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AccountingVoucherItem } from "@/lib/types/accounting";
import type { AccountingCashEntryTaxLineInput } from "@/lib/types/accounting-cash-book";
import type {
  PosZAutopilotImportRow,
  PosZAutopilotStatus,
  PosZAutopilotStep,
} from "@/lib/types/accounting-pos-z-autopilot";

function centsToEuro(cents: number): number {
  return Math.round(cents) / 100;
}

function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

function grossTaxAmountEuro(grossEuro: number, ratePercent: number): string {
  if (ratePercent <= 0) return "0";
  const net = grossEuro / (1 + ratePercent / 100);
  return String(Math.round((grossEuro - net) * 100) / 100);
}

function splitAmountByVatShares(
  amountCents: number,
  vatByRate: Array<{ rate: number; grossCents: number }>,
): AccountingCashEntryTaxLineInput[] {
  if (amountCents <= 0) return [];
  const totalVatGross = vatByRate.reduce((sum, row) => sum + row.grossCents, 0);
  if (totalVatGross <= 0 || vatByRate.length === 0) {
    return [{ amount: centsToEuro(amountCents), tax_rate_percent: 19 }];
  }

  const lines: AccountingCashEntryTaxLineInput[] = [];
  let allocated = 0;
  vatByRate.forEach((row, index) => {
    const isLast = index === vatByRate.length - 1;
    const shareCents = isLast
      ? amountCents - allocated
      : Math.round((amountCents * row.grossCents) / totalVatGross);
    allocated += shareCents;
    if (shareCents <= 0) return;
    lines.push({
      amount: centsToEuro(shareCents),
      tax_rate_percent: row.rate,
    });
  });
  return lines.filter((line) => line.amount > 0);
}

async function findIncomeCategoryId(
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>,
  restaurantId: string,
  name: string,
): Promise<string | null> {
  const { data } = await admin
    .from("accounting_cash_categories")
    .select("id")
    .eq("restaurant_id", restaurantId)
    .eq("direction", "income")
    .eq("archived", false)
    .ilike("name", name)
    .maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function sumCashTipCents(params: {
  admin: NonNullable<ReturnType<typeof createSupabaseAdminClient>>;
  restaurantId: string;
  sessionOpenedAt: string;
  sessionClosedAt: string;
}): Promise<number> {
  const { data } = await params.admin
    .from("pos_payments")
    .select("tip_cents, method")
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "paid")
    .eq("method", "cash")
    .gte("paid_at", params.sessionOpenedAt)
    .lte("paid_at", params.sessionClosedAt);

  let tips = 0;
  for (const row of data ?? []) {
    tips += Number(row.tip_cents ?? 0);
  }
  return Math.max(0, tips);
}

function deriveStatus(steps: PosZAutopilotStep[]): PosZAutopilotStatus {
  const actionable = steps.filter((s) => s.status !== "waiting");
  if (actionable.length === 0) return "skipped";
  if (actionable.every((s) => s.status === "skipped")) return "skipped";
  if (actionable.some((s) => s.status === "error")) {
    if (actionable.some((s) => s.status === "ok")) return "partial";
    return "error";
  }
  if (
    actionable.every((s) => s.status === "ok" || s.status === "skipped")
  ) {
    return "ok";
  }
  return "running";
}

function mapImportRow(row: Record<string, unknown>): PosZAutopilotImportRow {
  const stepsRaw = row.steps;
  const steps = Array.isArray(stepsRaw)
    ? (stepsRaw as PosZAutopilotStep[])
    : [];
  return {
    id: String(row.id),
    restaurant_id: String(row.restaurant_id),
    pos_register_session_id: String(row.pos_register_session_id),
    z_nr: row.z_nr == null ? null : Number(row.z_nr),
    business_date: (row.business_date as string | null) ?? null,
    status: (row.status as PosZAutopilotStatus) ?? "pending",
    steps,
    cash_book_imported: Boolean(row.cash_book_imported),
    cash_entry_ids: (row.cash_entry_ids as string[] | null) ?? [],
    lexoffice_voucher_id: (row.lexoffice_voucher_id as string | null) ?? null,
    unbar_gross_cents: Number(row.unbar_gross_cents ?? 0),
    fee_cents: Number(row.fee_cents ?? 0),
    fee_voucher_id: (row.fee_voucher_id as string | null) ?? null,
    retry_count: Number(row.retry_count ?? 0),
    last_error: (row.last_error as string | null) ?? null,
    completed_at: (row.completed_at as string | null) ?? null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export type PostPosRegisterSessionToAccountingResult = {
  skipped: boolean;
  reason?: string;
  importRow: PosZAutopilotImportRow | null;
  cashBookImported: boolean;
  lexofficeVoucherId: string | null;
  cashEntryIds: string[];
  error?: string;
};

/**
 * POS-Z Autopilot: Kassenbuch + Lexoffice + Platzhalter Unbar/Gebühren.
 * Idempotent, Retry-fähig. Fehler brechen den Z-Abschluss nicht ab.
 */
export async function postPosRegisterSessionToAccounting(params: {
  restaurantId: string;
  sessionId: string;
  actorUserId?: string | null;
  forceRetry?: boolean;
}): Promise<PostPosRegisterSessionToAccountingResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      skipped: true,
      reason: "admin_unavailable",
      importRow: null,
      cashBookImported: false,
      lexofficeVoucherId: null,
      cashEntryIds: [],
      error: "admin_unavailable",
    };
  }

  const settings = await getAccountingSettings(admin, params.restaurantId);
  const importCash = settings.import_pos_z_to_cash_book === true;
  const pushLex = settings.push_pos_z_to_lexoffice === true;

  const { data: existingRaw } = await admin
    .from("accounting_pos_z_imports")
    .select("*")
    .eq("pos_register_session_id", params.sessionId)
    .maybeSingle();

  const existing = existingRaw
    ? mapImportRow(existingRaw as Record<string, unknown>)
    : null;

  if (!importCash && !pushLex) {
    const steps: PosZAutopilotStep[] = [
      {
        key: "cash_book",
        label: "Kassenbuch",
        status: "skipped",
        detail: "Autopilot aus",
      },
      {
        key: "lexoffice_sales",
        label: "Lexoffice Umsatz",
        status: "skipped",
        detail: "Autopilot aus",
      },
      {
        key: "unbar",
        label: "Unbar",
        status: "waiting",
        detail: "Zahlungsdienstleister folgt",
      },
      {
        key: "psp_fees",
        label: "PSP-Gebühren",
        status: "waiting",
        detail: "Mit Settlement (Mollie/Adyen)",
      },
    ];
    await admin.from("accounting_pos_z_imports").upsert(
      {
        restaurant_id: params.restaurantId,
        pos_register_session_id: params.sessionId,
        status: "skipped",
        steps,
        cash_book_imported: false,
        cash_entry_ids: [],
        lexoffice_voucher_id: null,
        last_error: null,
        completed_at: new Date().toISOString(),
      },
      { onConflict: "pos_register_session_id" },
    );
    return {
      skipped: true,
      reason: "disabled",
      importRow: null,
      cashBookImported: false,
      lexofficeVoucherId: null,
      cashEntryIds: [],
    };
  }

  const alreadyDone =
    existing &&
    existing.status === "ok" &&
    (!importCash || existing.cash_book_imported) &&
    (!pushLex || existing.lexoffice_voucher_id);

  if (alreadyDone && !params.forceRetry) {
    return {
      skipped: true,
      reason: "already_imported",
      importRow: existing,
      cashBookImported: existing.cash_book_imported,
      lexofficeVoucherId: existing.lexoffice_voucher_id,
      cashEntryIds: existing.cash_entry_ids,
    };
  }

  const session = await getRegisterSessionById(
    params.sessionId,
    params.restaurantId,
  );
  if (!session?.closed_at) {
    return {
      skipped: true,
      reason: "session_not_closed",
      importRow: existing,
      cashBookImported: false,
      lexofficeVoucherId: null,
      cashEntryIds: [],
      error: "session_not_closed",
    };
  }

  const aggregate = await loadRegisterSessionAggregate(session);
  const businessDate = (session.closed_at ?? new Date().toISOString()).slice(
    0,
    10,
  );
  const zLabel =
    aggregate.zNr != null
      ? `Z${aggregate.zNr}`
      : `Sitzung ${session.id.slice(0, 8)}`;

  const unbarGrossCents = Math.max(0, aggregate.totalNonCashSalesCents);
  const cashTipCents = await sumCashTipCents({
    admin,
    restaurantId: params.restaurantId,
    sessionOpenedAt: session.opened_at,
    sessionClosedAt: session.closed_at,
  });
  const cashSalesCents = Math.max(
    0,
    aggregate.cashPaymentsCents - cashTipCents,
  );

  let cashEntryIds: string[] = params.forceRetry
    ? []
    : [...(existing?.cash_entry_ids ?? [])];
  let cashBookImported =
    !params.forceRetry && Boolean(existing?.cash_book_imported);
  let lexofficeVoucherId = params.forceRetry
    ? null
    : (existing?.lexoffice_voucher_id ?? null);

  const steps: PosZAutopilotStep[] = [
    {
      key: "cash_book",
      label: "Kassenbuch (Bar)",
      status: importCash ? "pending" : "skipped",
      detail: importCash ? null : "Deaktiviert",
    },
    {
      key: "lexoffice_sales",
      label: "Lexoffice Umsatz",
      status: pushLex ? "pending" : "skipped",
      detail: pushLex ? null : "Deaktiviert",
    },
    {
      key: "unbar",
      label: "Unbar",
      status: unbarGrossCents > 0 ? "waiting" : "skipped",
      detail:
        unbarGrossCents > 0
          ? `${formatEuroFromCents(unbarGrossCents)} · Anbieter folgt`
          : "Kein Unbar in dieser Session",
    },
    {
      key: "psp_fees",
      label: "PSP-Gebühren",
      status: "waiting",
      detail:
        "Gebühren werden mit Settlement gebucht (z. B. 1.200 € Unbar − Gebühr → Netto)",
    },
  ];

  const setStep = (
    key: PosZAutopilotStep["key"],
    patch: Partial<PosZAutopilotStep>,
  ) => {
    const idx = steps.findIndex((s) => s.key === key);
    if (idx >= 0) steps[idx] = { ...steps[idx]!, ...patch };
  };

  await admin.from("accounting_pos_z_imports").upsert(
    {
      restaurant_id: params.restaurantId,
      pos_register_session_id: params.sessionId,
      z_nr: aggregate.zNr,
      business_date: businessDate,
      status: "running",
      steps,
      unbar_gross_cents: unbarGrossCents,
      retry_count: (existing?.retry_count ?? 0) + (params.forceRetry ? 1 : 0),
      last_error: null,
      completed_at: null,
    },
    { onConflict: "pos_register_session_id" },
  );

  let lastError: string | null = null;

  try {
    if (importCash && (!cashBookImported || params.forceRetry)) {
      await ensureAccountingCashBookDefaults(admin, params.restaurantId);
      const barCat = await findIncomeCategoryId(
        admin,
        params.restaurantId,
        "Barverkauf",
      );
      const tipCat = await findIncomeCategoryId(
        admin,
        params.restaurantId,
        "Trinkgeld",
      );
      if (!barCat) {
        throw new Error("cash_category_barverkauf_missing");
      }

      const noteBase = `POS ${zLabel} · ${businessDate}`;
      const createdIds: string[] = [];

      if (cashSalesCents > 0) {
        const taxLines = splitAmountByVatShares(
          cashSalesCents,
          aggregate.vatByRate,
        );
        const created = await upsertAccountingCashEntry(
          admin,
          params.restaurantId,
          {
            entry_date: businessDate,
            direction: "income",
            category_id: barCat,
            note: `${noteBase} · Barverkauf`,
            tax_lines: taxLines,
          },
        );
        if (!created.row) {
          throw new Error(created.error ?? "cash_entry_barverkauf_failed");
        }
        createdIds.push(created.row.id);
      }

      if (cashTipCents > 0 && tipCat) {
        const created = await upsertAccountingCashEntry(
          admin,
          params.restaurantId,
          {
            entry_date: businessDate,
            direction: "income",
            category_id: tipCat,
            note: `${noteBase} · Trinkgeld`,
            tax_lines: [
              { amount: centsToEuro(cashTipCents), tax_rate_percent: 0 },
            ],
          },
        );
        if (!created.row) {
          throw new Error(created.error ?? "cash_entry_tip_failed");
        }
        createdIds.push(created.row.id);
      }

      cashEntryIds = createdIds;
      cashBookImported = true;
      setStep("cash_book", {
        status: "ok",
        detail:
          cashSalesCents + cashTipCents > 0
            ? `${formatEuroFromCents(cashSalesCents + cashTipCents)} gebucht`
            : "Keine Bar-Einnahmen",
        error: null,
      });
    } else if (importCash && cashBookImported) {
      setStep("cash_book", {
        status: "ok",
        detail: "Bereits gebucht",
        error: null,
      });
    }

    if (pushLex && !lexofficeVoucherId) {
      const actorUserId =
        params.actorUserId?.trim() ||
        session.closed_by_profile_id?.trim() ||
        null;
      if (!actorUserId) {
        throw new Error("lexoffice_actor_missing");
      }

      const voucherItems: AccountingVoucherItem[] = [];
      let sortOrder = 0;
      for (const row of aggregate.vatByRate) {
        if (row.grossCents <= 0) continue;
        const amount = centsToEuro(row.grossCents);
        voucherItems.push({
          id: crypto.randomUUID(),
          sortOrder: sortOrder++,
          label: `POS ${zLabel} · Umsatz ${row.rate} %`,
          amount,
          taxAmount: Number(grossTaxAmountEuro(amount, row.rate)),
          taxRatePercent: row.rate,
          categoryLabel: "POS Tagesabschluss",
        });
      }

      const tipFromOrdersCents = Math.max(
        0,
        aggregate.totalSalesCents -
          aggregate.vatByRate.reduce((sum, row) => sum + row.grossCents, 0),
      );
      if (tipFromOrdersCents > 0) {
        voucherItems.push({
          id: crypto.randomUUID(),
          sortOrder: sortOrder++,
          label: `POS ${zLabel} · Trinkgeld`,
          amount: centsToEuro(tipFromOrdersCents),
          taxAmount: 0,
          taxRatePercent: 0,
          categoryLabel: "Trinkgeld",
        });
      }

      if (voucherItems.length === 0) {
        setStep("lexoffice_sales", {
          status: "skipped",
          detail: "Kein Umsatz",
          error: null,
        });
      } else {
        const created = await createAccountingVoucher(admin, {
          restaurantId: params.restaurantId,
          userId: actorUserId,
          input: {
            voucherKind: "sales",
            voucherDate: businessDate,
            taxMode: "gross",
            useCollectiveContact: true,
            contactName: "POS Tagesabschluss",
            voucherNumber: zLabel,
            remark: `Autopilot aus POS-Kassensitzung ${session.id}`,
            voucherItems,
            syncToLexoffice: true,
            status: "open",
          },
        });
        if (!created.row) {
          throw new Error(created.error ?? "lexoffice_voucher_failed");
        }
        lexofficeVoucherId = created.row.id;
        setStep("lexoffice_sales", {
          status: "ok",
          detail: `Beleg ${zLabel}`,
          error: null,
        });
      }
    } else if (pushLex && lexofficeVoucherId) {
      setStep("lexoffice_sales", {
        status: "ok",
        detail: "Bereits gesendet",
        error: null,
      });
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : "pos_z_import_failed";
    console.error("[accounting] POS Z Autopilot failed", {
      restaurantId: params.restaurantId,
      sessionId: params.sessionId,
      error: lastError,
    });
    if (importCash && !cashBookImported) {
      setStep("cash_book", { status: "error", error: lastError });
    }
    if (pushLex && !lexofficeVoucherId) {
      setStep("lexoffice_sales", { status: "error", error: lastError });
    }
  }

  const status = deriveStatus(steps);
  const completedAt =
    status === "ok" || status === "skipped" || status === "partial"
      ? new Date().toISOString()
      : status === "error"
        ? new Date().toISOString()
        : null;

  const { data: upserted, error: upsertError } = await admin
    .from("accounting_pos_z_imports")
    .upsert(
      {
        restaurant_id: params.restaurantId,
        pos_register_session_id: params.sessionId,
        z_nr: aggregate.zNr,
        business_date: businessDate,
        status,
        steps,
        cash_book_imported: cashBookImported,
        cash_entry_ids: cashEntryIds,
        lexoffice_voucher_id: lexofficeVoucherId,
        unbar_gross_cents: unbarGrossCents,
        fee_cents: existing?.fee_cents ?? 0,
        fee_voucher_id: existing?.fee_voucher_id ?? null,
        retry_count: (existing?.retry_count ?? 0) + (params.forceRetry ? 1 : 0),
        last_error: lastError,
        completed_at: completedAt,
      },
      { onConflict: "pos_register_session_id" },
    )
    .select("*")
    .single();

  if (upsertError) {
    console.error("[accounting] POS Z Autopilot upsert", upsertError.message);
  }

  return {
    skipped: false,
    importRow: upserted
      ? mapImportRow(upserted as Record<string, unknown>)
      : null,
    cashBookImported,
    lexofficeVoucherId,
    cashEntryIds,
    error: lastError ?? undefined,
  };
}

export async function getPosZAutopilotImport(
  restaurantId: string,
  sessionId: string,
): Promise<PosZAutopilotImportRow | null> {
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data } = await admin
    .from("accounting_pos_z_imports")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .eq("pos_register_session_id", sessionId)
    .maybeSingle();
  return data ? mapImportRow(data as Record<string, unknown>) : null;
}

export async function listPosZAutopilotImports(
  restaurantId: string,
  sessionIds: string[],
): Promise<PosZAutopilotImportRow[]> {
  if (sessionIds.length === 0) return [];
  const admin = createSupabaseAdminClient();
  if (!admin) return [];
  const { data } = await admin
    .from("accounting_pos_z_imports")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .in("pos_register_session_id", sessionIds);
  return (data ?? []).map((row) =>
    mapImportRow(row as Record<string, unknown>),
  );
}

export async function retryPosZAutopilot(params: {
  restaurantId: string;
  sessionId: string;
  actorUserId?: string | null;
}): Promise<PostPosRegisterSessionToAccountingResult> {
  return postPosRegisterSessionToAccounting({
    ...params,
    forceRetry: true,
  });
}
