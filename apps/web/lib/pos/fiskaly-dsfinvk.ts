import "server-only";

const DEFAULT_DSFINVK_BASE_URL = "https://dsfinvk.fiskaly.com/api/v1";

let cachedDsfinvkToken: { value: string; expiresAt: number } | null = null;

export function normalizeFiskalyDsfinvkBaseUrl(url?: string): string {
  const trimmed = (url?.trim() || DEFAULT_DSFINVK_BASE_URL).replace(/\/$/, "");
  if (trimmed.includes("kassensichv-middleware")) {
    return DEFAULT_DSFINVK_BASE_URL;
  }
  return trimmed;
}

export function formatDsfinvkHttpError(status: number, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return `Fiskaly DSFinV-K HTTP ${status}`;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      code?: string;
      message?: string;
      error?: string | { code?: string; message?: string };
    };
    const nested =
      parsed.error && typeof parsed.error === "object" ? parsed.error : null;
    const code = parsed.code ?? nested?.code ?? (typeof parsed.error === "string" ? parsed.error : undefined);
    const message = parsed.message ?? nested?.message;
    if (code && message) {
      return `Fiskaly DSFinV-K HTTP ${status}: ${code} — ${message}`;
    }
    if (code) {
      return `Fiskaly DSFinV-K HTTP ${status}: ${code}`;
    }
    if (message) {
      return `Fiskaly DSFinV-K HTTP ${status}: ${message}`;
    }
  } catch {
    // not JSON
  }

  const snippet =
    trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
  return `Fiskaly DSFinV-K HTTP ${status}: ${snippet}`;
}

export async function fiskalyDsfinvkAuthToken(
  dsfinvkBaseUrl: string,
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  const now = Date.now();
  if (cachedDsfinvkToken && cachedDsfinvkToken.expiresAt - now > 60_000) {
    return cachedDsfinvkToken.value;
  }

  const base = normalizeFiskalyDsfinvkBaseUrl(dsfinvkBaseUrl);
  const res = await fetch(`${base}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatDsfinvkHttpError(res.status, body));
  }

  const data = (await res.json()) as {
    access_token: string;
    access_token_expires_in: number;
  };

  cachedDsfinvkToken = {
    value: data.access_token,
    expiresAt: now + data.access_token_expires_in * 1000,
  };
  return data.access_token;
}

export function clearFiskalyDsfinvkAuthTokenCache(): void {
  cachedDsfinvkToken = null;
}

export type DsfinvkCashRegisterMeta = {
  brand?: string;
  model?: string;
  softwareBrand?: string;
  softwareVersion?: string;
};

const DEFAULT_REGISTER_META: Required<DsfinvkCashRegisterMeta> = {
  brand: "Gwada",
  model: "Staff POS",
  softwareBrand: "Gwada",
  softwareVersion: "1.0",
};

export async function upsertDsfinvkCashRegister(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  tssId: string;
  meta?: DsfinvkCashRegisterMeta;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const meta = { ...DEFAULT_REGISTER_META, ...params.meta };
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const res = await fetch(`${base}/cash_registers/${params.clientId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        cash_register_type: {
          type: "MASTER",
          tss_id: params.tssId,
        },
        brand: meta.brand.slice(0, 50),
        model: meta.model.slice(0, 50),
        software: {
          brand: meta.softwareBrand.slice(0, 50),
          version: meta.softwareVersion.slice(0, 50),
        },
        base_currency_code: "EUR",
      }),
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: formatDsfinvkHttpError(res.status, body) };
    }

    return { ok: true };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "dsfinvk_cash_register_failed";
    return { ok: false, error: message };
  }
}

export type DsfinvkCashPointClosingPayload = {
  client_id: string;
  cash_point_closing_export_id: number;
  head?: {
    first_transaction_export_id?: string;
    last_transaction_export_id?: string;
    export_creation_date?: number;
  };
  cash_statement?: Record<string, unknown>;
  /** Sibling of cash_statement per DSFinV-K closing structure (not nested inside it). */
  transactions?: Record<string, unknown>[];
  metadata?: Record<string, string> | null;
};

export type DsfinvkCashPointClosingResponse = {
  closing_id?: string;
  state?: string;
  error?: { code?: string; message?: string };
  cash_point_closing_export_id?: number;
  business_date?: string;
};

/** Upsert cash point closing (Fiskaly DSFinV-K uses PUT, not POST). */
export async function insertDsfinvkCashPointClosing(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  closingId: string;
  payload: DsfinvkCashPointClosingPayload;
}): Promise<
  | { ok: true; response: DsfinvkCashPointClosingResponse }
  | { ok: false; error: string }
> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const res = await fetch(`${base}/cash_point_closings/${params.closingId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(params.payload),
      signal: AbortSignal.timeout(30_000),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: formatDsfinvkHttpError(res.status, bodyText),
      };
    }

    const response = JSON.parse(bodyText || "{}") as DsfinvkCashPointClosingResponse;
    return { ok: true, response };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "dsfinvk_cash_point_closing_failed";
    return { ok: false, error: message };
  }
}

function parseCashPointClosingState(
  response: DsfinvkCashPointClosingResponse,
): string | undefined {
  return response.state;
}

async function dsfinvkAuthGet(
  base: string,
  token: string,
  path: string,
): Promise<{ ok: true; body: string } | { ok: false; status: number; error: string }> {
  const res = await fetch(`${base}${path}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(15_000),
  });
  const bodyText = await res.text();
  if (!res.ok) {
    return {
      ok: false,
      status: res.status,
      error: formatDsfinvkHttpError(res.status, bodyText),
    };
  }
  return { ok: true, body: bodyText };
}

/** Poll closing status — retrieve by id, then list fallback. */
export async function getDsfinvkCashPointClosingStatus(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  closingId: string;
  clientId: string;
}): Promise<
  | { ok: true; response: DsfinvkCashPointClosingResponse }
  | { ok: false; error: string; notFoundYet?: boolean }
> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const byId = await dsfinvkAuthGet(
      base,
      token,
      `/cash_point_closings/${params.closingId}`,
    );
    if (byId.ok) {
      const response = JSON.parse(byId.body || "{}") as DsfinvkCashPointClosingResponse;
      return { ok: true, response };
    }
    if (byId.status !== 404) {
      return { ok: false, error: byId.error };
    }

    const list = await dsfinvkAuthGet(
      base,
      token,
      `/cash_point_closings?client_id=${encodeURIComponent(params.clientId)}&limit=100`,
    );
    if (!list.ok) {
      if (list.status === 404) {
        return {
          ok: false,
          error: "cash_point_closing_not_found",
          notFoundYet: true,
        };
      }
      return { ok: false, error: list.error };
    }

    const parsed = JSON.parse(list.body || "{}") as {
      data?: DsfinvkCashPointClosingResponse[];
    };
    const match = (parsed.data ?? []).find(
      (row) => row.closing_id === params.closingId,
    );

    if (!match) {
      return {
        ok: false,
        error: "cash_point_closing_not_found",
        notFoundYet: true,
      };
    }

    return { ok: true, response: match };
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "dsfinvk_cash_point_closing_get_failed";
    return { ok: false, error: message };
  }
}

export async function waitForDsfinvkCashPointClosing(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  closingId: string;
  clientId: string;
  initialResponse?: DsfinvkCashPointClosingResponse;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<
  | { ok: true; state: "COMPLETED"; response: DsfinvkCashPointClosingResponse }
  | { ok: false; error: string; state?: string }
> {
  const maxAttempts = params.maxAttempts ?? 12;
  const delayMs = params.delayMs ?? 1500;

  const evaluate = (
    response: DsfinvkCashPointClosingResponse,
  ):
    | { done: true; ok: true; response: DsfinvkCashPointClosingResponse }
    | { done: true; ok: false; error: string; state: string }
    | { done: false } => {
    const state = parseCashPointClosingState(response);
    if (state === "COMPLETED") {
      return { done: true, ok: true, response };
    }
    if (state === "ERROR") {
      const errMsg =
        response.error?.message ??
        response.error?.code ??
        "cash_point_closing_error";
      return { done: true, ok: false, error: errMsg, state };
    }
    return { done: false };
  };

  if (params.initialResponse) {
    const first = evaluate(params.initialResponse);
    if (first.done) {
      return first.ok
        ? { ok: true, state: "COMPLETED", response: first.response }
        : { ok: false, error: first.error, state: first.state };
    }
  }

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await getDsfinvkCashPointClosingStatus(params);
    if (!result.ok) {
      if (result.notFoundYet && attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        continue;
      }
      return { ok: false, error: result.error };
    }

    const verdict = evaluate(result.response);
    if (verdict.done) {
      return verdict.ok
        ? { ok: true, state: "COMPLETED", response: verdict.response }
        : { ok: false, error: verdict.error, state: verdict.state };
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return { ok: false, error: "cash_point_closing_timeout", state: "PENDING" };
}
