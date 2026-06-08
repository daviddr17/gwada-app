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

async function posFetch<T>(
  path: string,
  init: RequestInit & { restaurantId?: string } = {},
): Promise<T> {
  const token = await staffAccessToken();
  const base = getGwadaApiBaseUrl();
  const url = new URL(`${base}/api/pos${path}`);

  if (init.restaurantId) {
    url.searchParams.set("restaurantId", init.restaurantId);
  }

  const { restaurantId: _rid, ...fetchInit } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), POS_FETCH_TIMEOUT_MS);

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
        "api_unreachable",
        `Web-API nicht erreichbar (${base}). Läuft pnpm dev auf Port 3000?`,
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
