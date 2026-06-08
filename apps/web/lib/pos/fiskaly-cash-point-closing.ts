import "server-only";

import { buildSignDeVatAmounts } from "@gwada/pos-domain";
import type { DsfinvkCashPointClosingPayload } from "@/lib/pos/fiskaly-dsfinvk";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

/** DFKA taxonomy VAT definition export IDs (Germany). */
function vatDefinitionExportId(vatRate: number): number {
  if (vatRate === 19) return 1;
  if (vatRate === 7) return 2;
  return 5;
}

function centsToEuroAmount(cents: number): number {
  return Math.round(cents) / 100;
}

function unixSeconds(iso: string | null | undefined): number {
  if (!iso) return Math.floor(Date.now() / 1000);
  return Math.floor(new Date(iso).getTime() / 1000);
}

type FiscalRow = {
  id: string;
  order_id: string;
  tx_id: string;
  client_id: string;
  signature: string;
  signature_counter: number;
  signed_at: string | null;
  pos_orders: {
    order_number: number | null;
    total_cents: number;
    tip_cents: number;
    closed_at: string | null;
  } | null;
};

type OrderLineRow = {
  order_id: string;
  name: string;
  line_total_cents: number;
  vat_rate: number;
};

type PaymentRow = {
  order_id: string;
  method: string;
  status: string;
};

export async function buildCashPointClosingPayload(params: {
  restaurantId: string;
  clientId: string;
  zNr: number;
  sessionOpenedAt: string;
  sessionClosedAt?: string;
  /** Same YYYY-MM-DD as export filter (Loyaro: one date at close). */
  businessDate: string;
}): Promise<
  | { ok: true; payload: DsfinvkCashPointClosingPayload }
  | { ok: false; error: string }
> {
  const admin = createSupabaseAdminClient();
  if (!admin) return { ok: false, error: "admin_unavailable" };

  const closedAt = params.sessionClosedAt ?? new Date().toISOString();

  const { data: fiscalRows, error: fiscalError } = await admin
    .from("pos_fiscal_transactions")
    .select(
      "id, order_id, tx_id, client_id, signature, signature_counter, signed_at, pos_orders(order_number, total_cents, tip_cents, closed_at)",
    )
    .eq("restaurant_id", params.restaurantId)
    .gte("signed_at", params.sessionOpenedAt)
    .lte("signed_at", closedAt)
    .order("signed_at", { ascending: true });

  if (fiscalError) {
    return { ok: false, error: fiscalError.message };
  }

  const rows: FiscalRow[] = (fiscalRows ?? []).map((row) => {
    const orderJoin = row.pos_orders as
      | { order_number?: number; total_cents?: number; tip_cents?: number; closed_at?: string | null }
      | { order_number?: number; total_cents?: number; tip_cents?: number; closed_at?: string | null }[]
      | null;
    const order = Array.isArray(orderJoin) ? orderJoin[0] : orderJoin;
    return {
      id: row.id as string,
      order_id: row.order_id as string,
      tx_id: row.tx_id as string,
      client_id: row.client_id as string,
      signature: row.signature as string,
      signature_counter: row.signature_counter as number,
      signed_at: row.signed_at as string | null,
      pos_orders: order
        ? {
            order_number:
              typeof order.order_number === "number" ? order.order_number : null,
            total_cents: Number(order.total_cents ?? 0),
            tip_cents: Number(order.tip_cents ?? 0),
            closed_at: order.closed_at ?? null,
          }
        : null,
    };
  });
  if (rows.length === 0) {
    return { ok: false, error: "no_signed_transactions_in_session" };
  }

  const orderIds = rows.map((r) => r.order_id);

  const [{ data: lines }, { data: payments }] = await Promise.all([
    admin
      .from("pos_order_lines")
      .select("order_id, name, line_total_cents, vat_rate")
      .in("order_id", orderIds)
      .order("position"),
    admin
      .from("pos_payments")
      .select("order_id, method, status")
      .in("order_id", orderIds)
      .eq("status", "paid"),
  ]);

  const linesByOrder = new Map<string, OrderLineRow[]>();
  for (const line of (lines ?? []) as OrderLineRow[]) {
    const list = linesByOrder.get(line.order_id) ?? [];
    list.push(line);
    linesByOrder.set(line.order_id, list);
  }

  const paymentByOrder = new Map<string, PaymentRow>();
  for (const payment of (payments ?? []) as PaymentRow[]) {
    paymentByOrder.set(payment.order_id, payment);
  }

  let totalCashCents = 0;
  let totalFullCents = 0;
  const businessCaseTotals = new Map<number, number>();
  const paymentTypeTotals = new Map<string, number>();

  const transactions: Record<string, unknown>[] = [];
  let txIndex = 0;

  for (const row of rows) {
    const order = row.pos_orders;
    if (!order) continue;

    const orderLines = linesByOrder.get(row.order_id) ?? [];
    const payment = paymentByOrder.get(row.order_id);
    const isCash = payment?.method === "cash";
    const paymentType = isCash ? "Bar" : "Unbar";
    const paymentName = isCash ? "Barzahlung" : "Unbarzahlung";

    const grossCents = Number(order.total_cents) + Number(order.tip_cents);
    totalFullCents += grossCents;
    if (isCash) totalCashCents += grossCents;
    paymentTypeTotals.set(
      paymentType,
      (paymentTypeTotals.get(paymentType) ?? 0) + grossCents,
    );

    const vatItems = orderLines.map((line) => ({
      totalCents: Number(line.line_total_cents),
      vatRate: Number(line.vat_rate),
    }));
    const vatAmounts = buildSignDeVatAmounts(vatItems);

    for (const vat of vatAmounts) {
      const rate =
        vat.vat_rate === "NORMAL"
          ? 19
          : vat.vat_rate === "REDUCED_1"
            ? 7
            : 0;
      const inclCents = Math.round(parseFloat(vat.incl_vat) * 100);
      businessCaseTotals.set(
        rate,
        (businessCaseTotals.get(rate) ?? 0) + inclCents,
      );
    }

    txIndex += 1;
    const exportId = String(order.order_number ?? txIndex);
    const timestamp = unixSeconds(row.signed_at ?? order.closed_at);

    transactions.push({
      head: {
        type: "Beleg",
        name: order.order_number != null ? `Bestellung #${order.order_number}` : "Bestellung",
        storno: false,
        number: order.order_number ?? txIndex,
        timestamp_start: timestamp,
        timestamp_end: timestamp,
        tx_id: row.tx_id,
        transaction_export_id: exportId,
        closing_client_id: params.clientId,
      },
      data: {
        full_amount_incl_vat: centsToEuroAmount(grossCents),
        payment_types: [
          {
            type: paymentType,
            name: paymentName,
            currency_code: "EUR",
            amount: centsToEuroAmount(grossCents),
          },
        ],
        amounts_per_vat_id: vatAmounts.map((vat) => {
          const rate =
            vat.vat_rate === "NORMAL"
              ? 19
              : vat.vat_rate === "REDUCED_1"
                ? 7
                : 0;
          return {
            incl_vat: parseFloat(vat.incl_vat),
            excl_vat: parseFloat(vat.excl_vat),
            vat: parseFloat(vat.vat),
            vat_definition_export_id: vatDefinitionExportId(rate),
          };
        }),
        lines: orderLines.map((line, lineIndex) => ({
          lineitem_export_id: `${exportId}-${lineIndex + 1}`,
          business_case: {
            type: "Umsatz",
            name: line.name.slice(0, 60),
            amounts_per_vat_id: [
              {
                incl_vat: centsToEuroAmount(Number(line.line_total_cents)),
                excl_vat: centsToEuroAmount(
                  Math.round(
                    Number(line.line_total_cents) /
                      (1 + Number(line.vat_rate) / 100),
                  ),
                ),
                vat: centsToEuroAmount(
                  Number(line.line_total_cents) -
                    Math.round(
                      Number(line.line_total_cents) /
                        (1 + Number(line.vat_rate) / 100),
                    ),
                ),
                vat_definition_export_id: vatDefinitionExportId(
                  Number(line.vat_rate),
                ),
              },
            ],
          },
          in_house: true,
          storno: false,
          text: line.name.slice(0, 255),
          item: {
            number: String(lineIndex + 1),
            quantity: 1,
            quantity_factor: 1,
            quantity_measure: "Stk",
            price_per_unit: centsToEuroAmount(Number(line.line_total_cents)),
          },
        })),
      },
      security: {
        tss_tx_id: row.tx_id,
      },
    });
  }

  const firstExportId = String(
    rows[0]?.pos_orders?.order_number ?? 1,
  );
  const lastExportId = String(
    rows[rows.length - 1]?.pos_orders?.order_number ?? txIndex,
  );

  const businessCases = Array.from(businessCaseTotals.entries()).map(
    ([rate, inclCents]) => {
      const netCents = Math.round(inclCents / (1 + rate / 100));
      const vatCents = inclCents - netCents;
      return {
        type: "Umsatz",
        name: "Umsatz",
        amounts_per_vat_id: [
          {
            incl_vat: centsToEuroAmount(inclCents),
            excl_vat: centsToEuroAmount(netCents),
            vat: centsToEuroAmount(vatCents),
            vat_definition_export_id: vatDefinitionExportId(rate),
          },
        ],
      };
    },
  );

  const paymentTypes = Array.from(paymentTypeTotals.entries()).map(
    ([type, amountCents]) => ({
      type,
      name: type === "Bar" ? "Barzahlung" : "Unbarzahlung",
      currency_code: "EUR",
      amount: centsToEuroAmount(amountCents),
    }),
  );

  const payload: DsfinvkCashPointClosingPayload = {
    client_id: params.clientId,
    cash_point_closing_export_id: params.zNr,
    head: {
      first_transaction_export_id: firstExportId,
      last_transaction_export_id: lastExportId,
      export_creation_date: unixSeconds(closedAt),
      business_date: params.businessDate,
    },
    cash_statement: {
      business_cases: businessCases,
      payment: {
        full_amount: centsToEuroAmount(totalFullCents),
        cash_amount: centsToEuroAmount(totalCashCents),
        cash_amounts_by_currency: [
          {
            currency_code: "EUR",
            amount: centsToEuroAmount(totalCashCents),
          },
        ],
        payment_types: paymentTypes,
      },
    },
    transactions,
    metadata: {
      gwada_restaurant_id: params.restaurantId,
      gwada_session_opened_at: params.sessionOpenedAt,
    },
  };

  return { ok: true, payload };
}
