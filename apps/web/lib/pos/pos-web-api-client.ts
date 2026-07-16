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

async function posWebFetch<T>(
  path: string,
  restaurantId: string,
  init?: RequestInit,
): Promise<{ ok: true; data: T } | { ok: false; error: string; status: number }> {
  const url = new URL(path, window.location.origin);
  url.searchParams.set("restaurantId", restaurantId);
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

export async function fetchPosActiveOrders(restaurantId: string) {
  return posWebFetch<{ orders: PosWebOrderDto[] }>(
    "/api/pos/orders/active",
    restaurantId,
  );
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
