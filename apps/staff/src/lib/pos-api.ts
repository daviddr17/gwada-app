import type { Session } from "@supabase/supabase-js";
import { getGwadaApiBaseUrl } from "@/src/lib/env";
import { getStaffSupabase } from "@/src/lib/supabase";
import { useAuthStore } from "@/src/stores/auth-store";

export class PosApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message?: string) {
    super(message ?? code);
    this.status = status;
    this.code = code;
  }
}

async function staffAccessToken(): Promise<string> {
  const storeSession = useAuthStore.getState().session;
  const now = Math.floor(Date.now() / 1000);
  if (
    storeSession?.access_token &&
    (storeSession.expires_at ?? 0) - now > 60
  ) {
    return storeSession.access_token;
  }

  const sb = getStaffSupabase();
  const refreshed = await sb.auth.refreshSession();
  const session =
    refreshed.data.session ??
    (await sb.auth.getSession()).data.session ??
    storeSession;

  if (!session?.access_token) {
    throw new PosApiError(401, "unauthorized", "Nicht angemeldet — bitte erneut einloggen.");
  }

  if (session !== storeSession) {
    useAuthStore.setState({ session });
  }

  return session.access_token;
}

const POS_FETCH_TIMEOUT_MS = 12_000;
const DSFINVK_EXPORT_SERVER_WAIT_MS = 90_000;

async function posFetch<T>(
  path: string,
  init: RequestInit & { restaurantId?: string; timeoutMs?: number } = {},
): Promise<T> {
  const token = await staffAccessToken();
  const base = getGwadaApiBaseUrl();
  const url = new URL(`${base}/api/pos${path}`);

  if (init.restaurantId) {
    url.searchParams.set("restaurantId", init.restaurantId);
  }

  const { restaurantId: _rid, timeoutMs, ...fetchInit } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    timeoutMs ?? POS_FETCH_TIMEOUT_MS,
  );

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      ...fetchInit,
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(fetchInit.headers ?? {}),
      },
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new PosApiError(
        408,
        "request_timeout",
        `Zeitüberschreitung bei der Web-API (${base}). Bitte erneut versuchen.`,
      );
    }
    throw new PosApiError(
      503,
      "api_unreachable",
      `Web-API nicht erreichbar (${base}). Läuft pnpm dev auf Port 3000?`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    [key: string]: unknown;
  };

  if (!res.ok) {
    const code = body.error ?? "request_failed";
    let message = code;
    if (res.status === 401) {
      message =
        code === "unauthorized"
          ? "Anmeldung ungültig — bitte abmelden und erneut anmelden. Web-API: pnpm env:sync:local && pnpm dev neu starten."
          : "Sitzung abgelaufen — bitte erneut anmelden.";
    } else if (res.status === 403) {
      message = "Kein Zugriff auf dieses Restaurant.";
    }
    throw new PosApiError(res.status, code, message);
  }

  return body as T;
}

export type PosOrderLineDto = {
  id: string;
  menuItemId: string | null;
  name: string;
  quantity: number;
  unitPriceCents: number;
  vatRate: number;
  lineTotalCents: number;
};

export type PosOrderDto = {
  id: string;
  restaurantId: string;
  tableSessionId: string;
  orderNumber: number;
  status: string;
  totalCents: number;
  tipCents: number;
  paymentState: "unpaid" | "partial" | "paid";
  fiskalyFailedAt: string | null;
  receiptUrl: string | null;
  lines: PosOrderLineDto[];
  payments: Array<{ id: string; method: string; status: string; amountCents: number }>;
  fiscal: {
    txId: string;
    signature: string;
    signatureCounter: number;
    signedAt: string | null;
    receiptPublicUrl: string | null;
  } | null;
};

export async function openTableSession(params: {
  restaurantId: string;
  diningTableId: string;
  coverCount?: number;
}): Promise<{ sessionId: string }> {
  return posFetch("/table-sessions", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function createOrder(params: {
  restaurantId: string;
  tableSessionId: string;
  items: Array<{ menuItemId: string; quantity: number; notes?: string }>;
}): Promise<{ orderId: string; orderNumber: number; order: PosOrderDto | null }> {
  return posFetch("/orders", {
    method: "POST",
    body: JSON.stringify(params),
  });
}

export async function fetchActiveOrders(
  restaurantId: string,
): Promise<{ orders: PosOrderDto[] }> {
  return posFetch("/orders/active", { restaurantId });
}

export async function fetchPaidTodayOrders(
  restaurantId: string,
): Promise<{ orders: PosOrderDto[] }> {
  return posFetch("/orders/paid-today", { restaurantId });
}

export async function fetchOrder(
  restaurantId: string,
  orderId: string,
): Promise<{ order: PosOrderDto }> {
  return posFetch(`/orders/${orderId}`, { restaurantId });
}

export async function collectCash(params: {
  restaurantId: string;
  orderId: string;
  tipCents?: number;
  receivedAmountCents?: number;
}): Promise<{ paymentId: string; order: PosOrderDto | null }> {
  const { restaurantId, orderId, ...body } = params;
  return posFetch(`/payments/collect-cash/${orderId}`, {
    method: "PATCH",
    restaurantId,
    body: JSON.stringify(body),
  });
}

export async function retryFiskalySigning(params: {
  restaurantId: string;
  orderId: string;
}): Promise<{ order: PosOrderDto | null }> {
  const { restaurantId, orderId } = params;
  return posFetch(`/orders/${orderId}/retry-signing`, {
    method: "POST",
    restaurantId,
  });
}

export async function regenerateOrderReceipt(params: {
  restaurantId: string;
  orderId: string;
}): Promise<{ order: PosOrderDto | null }> {
  const { restaurantId, orderId } = params;
  return posFetch(`/orders/${orderId}/regenerate-receipt`, {
    method: "POST",
    restaurantId,
  });
}

export type StaffSession = Session;

export type RegisterSessionAggregateDto = {
  sessionId: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number | null;
  cashDifferenceCents: number | null;
  zNr: number | null;
  transactionCount: number;
  totalSalesCents: number;
  totalCashSalesCents: number;
  totalNonCashSalesCents: number;
};

export type RegisterStatusDto = {
  isOpen: boolean;
  sessionId: string | null;
  openedAt: string | null;
  openingCashCents: number | null;
  lastClosingZNr: number | null;
  lastClosingAt: string | null;
  aggregate: RegisterSessionAggregateDto | null;
};

export async function fetchRegisterStatus(
  restaurantId: string,
): Promise<RegisterStatusDto> {
  return posFetch("/fiskaly/register/status", { restaurantId });
}

export async function openRegister(params: {
  restaurantId: string;
  openingCashCents: number;
}): Promise<{
  sessionId: string;
  openedAt: string;
  openingCashCents: number;
}> {
  return posFetch("/fiskaly/register/open", {
    method: "POST",
    restaurantId: params.restaurantId,
    body: JSON.stringify({ openingCashCents: params.openingCashCents }),
  });
}

export async function closeRegister(params: {
  restaurantId: string;
  closingCashCents: number;
}): Promise<{
  sessionId: string;
  zNr: number;
  expectedCashCents: number;
  closingCashCents: number;
  cashDifferenceCents: number;
}> {
  return posFetch("/fiskaly/register/close", {
    method: "POST",
    restaurantId: params.restaurantId,
    timeoutMs: 90_000,
    body: JSON.stringify({ closingCashCents: params.closingCashCents }),
  });
}

export type RegisterSessionSummary = {
  id: string;
  openedAt: string;
  closedAt: string | null;
  openingCashCents: number;
  closingCashCents: number | null;
  expectedCashCents: number | null;
  cashDifferenceCents: number | null;
  zNr: number | null;
};

export async function listRegisterSessions(
  restaurantId: string,
  limit = 30,
): Promise<RegisterSessionSummary[]> {
  const token = await staffAccessToken();
  const base = getGwadaApiBaseUrl();
  const url = new URL(`${base}/api/pos/fiskaly/register/sessions`);
  url.searchParams.set("restaurantId", restaurantId);
  url.searchParams.set("limit", String(limit));

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const body = (await res.json().catch(() => ({}))) as {
    data?: RegisterSessionSummary[];
    error?: string;
  };
  if (!res.ok) {
    throw new PosApiError(
      res.status,
      body.error ?? "request_failed",
      body.error ?? "Abschlüsse konnten nicht geladen werden.",
    );
  }
  return body.data ?? [];
}

export async function downloadSessionDsfinvkZip(params: {
  restaurantId: string;
  sessionId: string;
}): Promise<{ bytes: ArrayBuffer; filename: string }> {
  const token = await staffAccessToken();
  const base = getGwadaApiBaseUrl();
  const url = new URL(
    `${base}/api/pos/fiskaly/register/sessions/${params.sessionId}/dsfinvk-download`,
  );
  url.searchParams.set("restaurantId", params.restaurantId);

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new PosApiError(
      res.status,
      body.error ?? "export_not_available",
      body.error ?? "DSFinV-K Export nicht verfügbar.",
    );
  }

  const disposition = res.headers.get("content-disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  return {
    bytes: await res.arrayBuffer(),
    filename: match?.[1] ?? `dsfinvk-${params.sessionId}.zip`,
  };
}

export async function fetchXReportPdf(
  restaurantId: string,
): Promise<{ sessionId: string; pdfUrl: string }> {
  return posFetch("/fiskaly/reports/x", { restaurantId });
}

export async function fetchZReportPdf(
  restaurantId: string,
  sessionId: string,
): Promise<{ sessionId: string; pdfUrl: string }> {
  return posFetch(`/fiskaly/reports/z/${sessionId}`, { restaurantId });
}

/** Ad-hoc export for a single business day (Loyaro: business_date filter + server wait). */
export async function downloadDsfinvkExportForDate(params: {
  restaurantId: string;
  businessDate: string;
}): Promise<{ bytes: ArrayBuffer; filename: string }> {
  const token = await staffAccessToken();
  const base = getGwadaApiBaseUrl();
  const url = new URL(`${base}/api/pos/fiskaly/exports/dsfinvk`);
  url.searchParams.set("restaurantId", params.restaurantId);

  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    DSFINVK_EXPORT_SERVER_WAIT_MS,
  );

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        dateFrom: params.businessDate,
        dateTo: params.businessDate,
        filter: "business",
      }),
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new PosApiError(
        408,
        "dsfinvk_export_timeout",
        "DSFinV-K Export dauert länger als erwartet.",
      );
    }
    throw new PosApiError(
      503,
      "api_unreachable",
      `Web-API nicht erreichbar (${base}). Läuft pnpm dev auf Port 3000?`,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.ok && res.headers.get("content-type")?.includes("zip")) {
    const disposition = res.headers.get("content-disposition") ?? "";
    const match = disposition.match(/filename="?([^"]+)"?/);
    return {
      bytes: await res.arrayBuffer(),
      filename: match?.[1] ?? `dsfinvk-${params.businessDate}.zip`,
    };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  throw new PosApiError(
    res.status,
    body.error ?? "dsfinvk_export_failed",
    body.error ?? "DSFinV-K Export fehlgeschlagen.",
  );
}
