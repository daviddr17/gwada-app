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

function centsToEuro(cents: number): number {
  return Math.round(cents) / 100;
}

function grossTaxAmountEuro(grossEuro: number, ratePercent: number): number {
  if (ratePercent <= 0) return 0;
  const net = grossEuro / (1 + ratePercent / 100);
  return Math.round((grossEuro - net) * 100) / 100;
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
  let query = params.admin
    .from("pos_payments")
    .select("tip_cents, method")
    .eq("restaurant_id", params.restaurantId)
    .eq("status", "paid")
    .eq("method", "cash")
    .gte("paid_at", params.sessionOpenedAt)
    .lte("paid_at", params.sessionClosedAt);

  const { data } = await query;
  let tips = 0;
  for (const row of data ?? []) {
    tips += Number(row.tip_cents ?? 0);
  }
  return Math.max(0, tips);
}

export type PostPosRegisterSessionToAccountingResult = {
  skipped: boolean;
  reason?: string;
  cashBookImported: boolean;
  lexofficeVoucherId: string | null;
  cashEntryIds: string[];
  error?: string;
};

/**
 * Nach erfolgreichem POS-Z-Abschluss: optional Kassenbuch + Lexoffice.
 * Idempotent über accounting_pos_z_imports. Fehler brechen den Z-Abschluss nicht ab.
 */
export async function postPosRegisterSessionToAccounting(params: {
  restaurantId: string;
  sessionId: string;
  actorUserId?: string | null;
}): Promise<PostPosRegisterSessionToAccountingResult> {
  const admin = createSupabaseAdminClient();
  if (!admin) {
    return {
      skipped: true,
      reason: "admin_unavailable",
      cashBookImported: false,
      lexofficeVoucherId: null,
      cashEntryIds: [],
      error: "admin_unavailable",
    };
  }

  const settings = await getAccountingSettings(admin, params.restaurantId);
  const importCash = settings.import_pos_z_to_cash_book === true;
  const pushLex = settings.push_pos_z_to_lexoffice === true;

  if (!importCash && !pushLex) {
    return {
      skipped: true,
      reason: "disabled",
      cashBookImported: false,
      lexofficeVoucherId: null,
      cashEntryIds: [],
    };
  }

  const { data: existing } = await admin
    .from("accounting_pos_z_imports")
    .select("id, cash_book_imported, cash_entry_ids, lexoffice_voucher_id")
    .eq("pos_register_session_id", params.sessionId)
    .maybeSingle();

  if (
    existing &&
    existing.cash_book_imported &&
    (!pushLex || existing.lexoffice_voucher_id)
  ) {
    return {
      skipped: true,
      reason: "already_imported",
      cashBookImported: Boolean(existing.cash_book_imported),
      lexofficeVoucherId: (existing.lexoffice_voucher_id as string | null) ?? null,
      cashEntryIds: (existing.cash_entry_ids as string[] | null) ?? [],
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
      cashBookImported: false,
      lexofficeVoucherId: null,
      cashEntryIds: [],
      error: "session_not_closed",
    };
  }

  const aggregate = await loadRegisterSessionAggregate(session);
  const businessDate =
    (session.closed_at ?? new Date().toISOString()).slice(0, 10);
  const zLabel =
    aggregate.zNr != null ? `Z${aggregate.zNr}` : `Sitzung ${session.id.slice(0, 8)}`;

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

  let cashEntryIds: string[] =
    (existing?.cash_entry_ids as string[] | null)?.filter(Boolean) ?? [];
  let cashBookImported = Boolean(existing?.cash_book_imported);
  let lexofficeVoucherId =
    (existing?.lexoffice_voucher_id as string | null) ?? null;
  let lastError: string | null = null;

  try {
    if (importCash && !cashBookImported) {
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
          taxAmount: grossTaxAmountEuro(amount, row.rate),
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
        // Kein Umsatz — Lexoffice überspringen, aber Kassenbuch ok.
        lastError = "lexoffice_no_sales";
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
            remark: `Automatisch aus POS-Kassensitzung ${session.id}`,
            voucherItems,
            syncToLexoffice: true,
            status: "open",
          },
        });
        if (!created.row) {
          throw new Error(created.error ?? "lexoffice_voucher_failed");
        }
        lexofficeVoucherId = created.row.id;
      }
    }
  } catch (e) {
    lastError = e instanceof Error ? e.message : "pos_z_import_failed";
    console.error("[accounting] POS Z import failed", {
      restaurantId: params.restaurantId,
      sessionId: params.sessionId,
      error: lastError,
    });
  }

  const { error: upsertError } = await admin.from("accounting_pos_z_imports").upsert(
    {
      restaurant_id: params.restaurantId,
      pos_register_session_id: params.sessionId,
      z_nr: aggregate.zNr,
      business_date: businessDate,
      cash_book_imported: cashBookImported,
      cash_entry_ids: cashEntryIds,
      lexoffice_voucher_id: lexofficeVoucherId,
      last_error: lastError,
    },
    { onConflict: "pos_register_session_id" },
  );

  if (upsertError) {
    console.error("[accounting] POS Z import log upsert", upsertError.message);
  }

  return {
    skipped: false,
    cashBookImported,
    lexofficeVoucherId,
    cashEntryIds,
    error: lastError ?? undefined,
  };
}
