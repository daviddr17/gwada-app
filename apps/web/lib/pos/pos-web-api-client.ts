"use client";

/** Slim client DTO — mirrors PosOrderDto without importing server-only. */
export type PosWebOrderDto = {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  tipCents: number;
  paymentState: string;
  tableSessionId: string;
  createdAt: string;
  closedAt: string | null;
  lines: Array<{
    id: string;
    name: string;
    quantity: number;
    openQuantity?: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
};

export type PosWebReceiptDto = {
  paymentId: string;
  orderId: string;
  orderNumber: number;
  tableSessionId: string;
  tableLabel: string;
  diningTableId: string;
  sessionStatus: string;
  method: string;
  status: string;
  amountCents: number;
  tipCents: number;
  receivedAmountCents: number | null;
  paidAt: string | null;
  canVoidCash: boolean;
  receiptPdfUrl: string | null;
};

export type PosWebStatisticsItemDto = {
  menuItemId: string | null;
  name: string;
  quantity: number;
  lineTotalCents: number;
  orderCount: number;
};

export type PosWebStatisticsDto = {
  fromYmd: string;
  toYmd: string;
  timeZone: string;
  netCents: number;
  tipCents: number;
  grossCents: number;
  refundedCents: number;
  paymentCount: number;
  refundedCount: number;
  avgBonCents: number;
  byMethod: {
    cashCents: number;
    cardCents: number;
    voucherCents: number;
    otherCents: number;
    cashCount: number;
    cardCount: number;
    voucherCount: number;
    otherCount: number;
  };
  byPaymentMethods?: Array<{
    id: string | null;
    label: string;
    kind: string | null;
    cents: number;
    count: number;
  }>;
  byDay: Array<{
    ymd: string;
    netCents: number;
    tipCents: number;
    grossCents: number;
    paymentCount: number;
    cashCents: number;
    cardCents: number;
    voucherCents: number;
    otherCents: number;
  }>;
  byItem?: PosWebStatisticsItemDto[];
  zSessions: Array<{
    id: string;
    openedAt: string;
    closedAt: string | null;
    openingCashCents: number;
    closingCashCents: number | null;
    expectedCashCents: number | null;
    cashDifferenceCents: number | null;
    zNr: number | null;
  }>;
};

export type PosWebOrderListItemDto = {
  id: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  tipCents: number;
  tableSessionId: string;
  tableLabel: string;
  createdAt: string;
  closedAt: string | null;
  lineCount: number;
  itemQuantity: number;
  linePreview: string;
};

export type PosWebRegisterSessionDto = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number | null;
  cashDifferenceCents: number | null;
  zNr: number | null;
};

async function posWebFetch<T>(
  path: string,
  restaurantId: string,
  init?: RequestInit,
  extraParams?: Record<string, string>,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("restaurantId", restaurantId);
  if (extraParams) {
    for (const [k, v] of Object.entries(extraParams)) {
      url.searchParams.set(k, v);
    }
  }
  const res = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? "request_failed",
      status: res.status,
    };
  }
  return { ok: true, data: body };
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objectUrl;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

export async function fetchPosActiveOrders(restaurantId: string) {
  return posWebFetch<{ orders: PosWebOrderDto[] }>(
    "/api/pos/orders/active",
    restaurantId,
  );
}

export async function fetchPosOrdersList(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  options: {
    status?: "all" | "open" | "delivered" | "cancelled";
    page?: number;
    pageSize?: number;
    search?: string;
  } = {},
) {
  return posWebFetch<{
    orders: PosWebOrderListItemDto[];
    from: string;
    to: string;
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }>("/api/pos/orders/list", restaurantId, undefined, {
    from: fromYmd,
    to: toYmd,
    status: options.status ?? "all",
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 50),
    ...(options.search?.trim()
      ? { q: options.search.trim() }
      : {}),
  });
}

export async function fetchPosPaidTodayOrders(restaurantId: string) {
  return posWebFetch<{ orders: PosWebOrderDto[] }>(
    "/api/pos/orders/paid-today",
    restaurantId,
  );
}

export async function fetchPosRegisterStatus(restaurantId: string) {
  return posWebFetch<{
    isOpen: boolean;
    sessionId: string | null;
    openedAt: string | null;
  }>("/api/pos/fiskaly/register/status", restaurantId);
}

export async function fetchPosReceipts(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
  options: {
    page?: number;
    pageSize?: number;
    method?: string;
    search?: string;
  } = {},
) {
  return posWebFetch<{
    fromYmd: string;
    toYmd: string;
    timeZone: string;
    receipts: PosWebReceiptDto[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }>("/api/pos/receipts", restaurantId, undefined, {
    from: fromYmd,
    to: toYmd,
    page: String(options.page ?? 1),
    pageSize: String(options.pageSize ?? 50),
    method: options.method ?? "all",
    ...(options.search?.trim()
      ? { q: options.search.trim() }
      : {}),
  });
}

export type PosVoidReasonDto = {
  id: string;
  name: string;
  restoreInventory: boolean;
  sortOrder: number;
  isActive: boolean;
};

export async function fetchPosVoidReasons(restaurantId: string) {
  return posWebFetch<{ reasons: PosVoidReasonDto[] }>(
    "/api/pos/void-reasons",
    restaurantId,
  );
}

export async function voidPosCashPayment(
  restaurantId: string,
  paymentId: string,
  reopenTable = true,
  voidReasonId?: string | null,
) {
  return posWebFetch<{
    ok: true;
    paymentId: string;
    tableSessionId: string;
    reopened: boolean;
    inventoryRestored: boolean;
    formalInvoiceStorno?: {
      mode: "none" | "voided_draft" | "correction";
      invoiceId?: string;
      invoiceNumber?: string | null;
      correctionId?: string;
      correctionNumber?: string | null;
      error?: string;
    };
  }>(`/api/pos/payments/${paymentId}/void-cash`, restaurantId, {
    method: "POST",
    body: JSON.stringify({
      restaurantId,
      reopenTable,
      ...(voidReasonId ? { voidReasonId } : {}),
    }),
  });
}

export async function regeneratePosReceipt(
  restaurantId: string,
  orderId: string,
) {
  return posWebFetch<{
    storagePath: string;
    order: PosWebOrderDto & { receiptUrl?: string | null };
  }>(`/api/pos/orders/${orderId}/regenerate-receipt`, restaurantId, {
    method: "POST",
  });
}

export async function fetchPosStatistics(
  restaurantId: string,
  fromYmd: string,
  toYmd: string,
) {
  return posWebFetch<PosWebStatisticsDto>(
    "/api/pos/statistics",
    restaurantId,
    undefined,
    { from: fromYmd, to: toYmd },
  );
}

export async function fetchPosRegisterSessions(
  restaurantId: string,
  limitOrOptions:
    | number
    | {
        page?: number;
        pageSize?: number;
        limit?: number;
        fromYmd?: string;
        toYmd?: string;
      } = 30,
  range?: { fromYmd: string; toYmd: string },
) {
  const opts =
    typeof limitOrOptions === "number"
      ? {
          pageSize: limitOrOptions,
          ...(range
            ? { fromYmd: range.fromYmd, toYmd: range.toYmd }
            : {}),
        }
      : limitOrOptions;

  return posWebFetch<{
    data: PosWebRegisterSessionDto[];
    page: number;
    pageSize: number;
    totalCount: number;
    totalPages: number;
  }>("/api/pos/fiskaly/register/sessions", restaurantId, undefined, {
    page: String(opts.page ?? 1),
    pageSize: String(opts.pageSize ?? opts.limit ?? 50),
    ...(opts.fromYmd && opts.toYmd
      ? { from: opts.fromYmd, to: opts.toYmd }
      : {}),
  });
}

export async function openPosXReportPdf(restaurantId: string) {
  const result = await posWebFetch<{ sessionId: string; pdfUrl: string }>(
    "/api/pos/fiskaly/reports/x",
    restaurantId,
  );
  if (!result.ok) return result;
  window.open(result.data.pdfUrl, "_blank", "noopener,noreferrer");
  return result;
}

export async function openPosZReportPdf(
  restaurantId: string,
  sessionId: string,
) {
  const result = await posWebFetch<{ sessionId: string; pdfUrl: string }>(
    `/api/pos/fiskaly/reports/z/${sessionId}`,
    restaurantId,
  );
  if (!result.ok) return result;
  window.open(result.data.pdfUrl, "_blank", "noopener,noreferrer");
  return result;
}

export async function downloadPosSessionDsfinvk(
  restaurantId: string,
  sessionId: string,
  filenameHint?: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const url = new URL(
    `/api/pos/fiskaly/register/sessions/${sessionId}/dsfinvk-download`,
    window.location.origin,
  );
  url.searchParams.set("restaurantId", restaurantId);
  const res = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error ?? "download_failed",
      status: res.status,
    };
  }
  const blob = await res.blob();
  triggerBlobDownload(
    blob,
    filenameHint?.trim() || `dsfinvk-${sessionId.slice(0, 8)}.zip`,
  );
  return { ok: true };
}

export async function startPosDsfinvkExport(
  restaurantId: string,
  dateFrom: string,
  dateTo: string,
): Promise<
  | { ok: true; mode: "zip"; blob: Blob }
  | {
      ok: true;
      mode: "async";
      exportId: string;
      state: string;
      ready: boolean;
    }
  | { ok: false; error: string; status: number }
> {
  const url = new URL("/api/pos/fiskaly/exports/dsfinvk", window.location.origin);
  url.searchParams.set("restaurantId", restaurantId);
  const res = await fetch(url.toString(), {
    method: "POST",
    cache: "no-store",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dateFrom, dateTo, filter: "business" }),
  });

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error ?? "export_failed",
      status: res.status,
    };
  }

  if (contentType.includes("application/zip")) {
    return { ok: true, mode: "zip", blob: await res.blob() };
  }

  const body = (await res.json()) as {
    exportId: string;
    state: string;
    ready: boolean;
  };
  return {
    ok: true,
    mode: "async",
    exportId: body.exportId,
    state: body.state,
    ready: body.ready,
  };
}

export async function pollPosDsfinvkExport(
  restaurantId: string,
  exportId: string,
) {
  return posWebFetch<{
    exportId: string;
    state: string;
    closingCount: number;
    ready: boolean;
  }>(`/api/pos/fiskaly/exports/dsfinvk/${exportId}`, restaurantId);
}

export async function downloadPosDsfinvkExport(
  restaurantId: string,
  exportId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const url = new URL(
    `/api/pos/fiskaly/exports/dsfinvk/${exportId}/download`,
    window.location.origin,
  );
  url.searchParams.set("restaurantId", restaurantId);
  const res = await fetch(url.toString(), {
    cache: "no-store",
    credentials: "same-origin",
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    return {
      ok: false,
      error: body.error ?? "download_failed",
      status: res.status,
    };
  }
  const blob = await res.blob();
  triggerBlobDownload(blob, `dsfinvk-${exportId}.zip`);
  return { ok: true };
}

export function downloadPosBlob(blob: Blob, filename: string) {
  triggerBlobDownload(blob, filename);
}

export function posApiErrorLabel(error: string): string {
  switch (error) {
    case "forbidden":
    case "permission_denied":
      return "Keine Berechtigung für diese Aktion.";
    case "not_cash_payment":
      return "Nur Barzahlungen können storniert werden.";
    case "payment_not_paid":
      return "Zahlung ist nicht stornierbar.";
    case "payment_not_found":
      return "Zahlung nicht gefunden.";
    case "fiskaly_not_configured":
      return "Fiskaly ist nicht konfiguriert.";
    case "fiscal_config_not_found":
      return "Keine Fiskal-Konfiguration für diesen Standort.";
    case "invalid_date_range":
      return "Ungültiger Zeitraum.";
    case "session_not_found":
      return "Kassensession nicht gefunden.";
    case "receipt_generation_failed":
      return "Quittung konnte nicht erzeugt werden.";
    case "void_reason_required":
      return "Bitte einen Storno-Grund wählen.";
    case "invalid_void_reason":
      return "Ungültiger Storno-Grund.";
    default:
      return error.replace(/_/g, " ");
  }
}
