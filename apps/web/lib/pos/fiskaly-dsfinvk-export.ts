import "server-only";

import {
  fiskalyDsfinvkAuthToken,
  formatDsfinvkHttpError,
  normalizeFiskalyDsfinvkBaseUrl,
} from "@/lib/pos/fiskaly-dsfinvk";

export type DsfinvkExportFilter = "creation" | "business";

type DsfinvkExportResource = {
  state?: string;
  error?: { code?: string; message?: string };
  cash_point_closings?: string[];
};

export function normalizeExportState(raw: string | undefined): string {
  return (raw ?? "PENDING").toUpperCase();
}

/**
 * Loyaro uses `todayStart.toISOString().split('T')[0]` (UTC day — wrong in DE evening).
 * Gwada: calendar day of close in Europe/Berlin, `YYYY-MM-DD` per Fiskaly spec.
 */
export function dsfinvkBusinessDateFromClose(
  closedAtIso: string,
  timeZone = "Europe/Berlin",
): string {
  return exportBusinessDate(closedAtIso, timeZone);
}

function berlinDayUnix(dateStr: string, endOfDay: boolean): number {
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = endOfDay ? 23 : 0;
  const m = endOfDay ? 59 : 0;
  const s = endOfDay ? 59 : 0;
  const time = `${pad(h)}:${pad(m)}:${pad(s)}`;

  for (const offset of ["+02:00", "+01:00"] as const) {
    const candidate = new Date(`${dateStr}T${time}${offset}`);
    const berlinDate = candidate.toLocaleDateString("en-CA", {
      timeZone: "Europe/Berlin",
    });
    if (berlinDate === dateStr) {
      return Math.floor(candidate.getTime() / 1000);
    }
  }

  return Math.floor(new Date(`${dateStr}T${time}+01:00`).getTime() / 1000);
}

export type DsfinvkExportTriggerResult =
  | {
      ok: true;
      exportId: string;
      state: string;
      closingCount: number;
    }
  | { ok: false; error: string };

export type DsfinvkExportPollResult =
  | { ok: true; state: string }
  | { ok: false; error: string; state?: string };

export async function triggerDsfinvkExport(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  dateFrom: string;
  dateTo: string;
  filter: DsfinvkExportFilter;
  exportId?: string;
}): Promise<DsfinvkExportTriggerResult> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);
  const exportId = params.exportId ?? crypto.randomUUID();

  const body =
    params.filter === "business"
      ? {
          business_date_start: params.dateFrom,
          business_date_end: params.dateTo,
          format: "zip",
          client_id: params.clientId,
        }
      : {
          start_date: berlinDayUnix(params.dateFrom, false),
          end_date: berlinDayUnix(params.dateTo, true),
          format: "zip",
          client_id: params.clientId,
        };

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const res = await fetch(`${base}/exports/${exportId}`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: formatDsfinvkHttpError(res.status, bodyText),
      };
    }

    const parsed = JSON.parse(bodyText || "{}") as DsfinvkExportResource;
    const state = normalizeExportState(parsed.state);
    if (state === "ERROR") {
      return {
        ok: false,
        error:
          parsed.error?.message ??
          "DSFinV-K Export konnte nicht gestartet werden.",
      };
    }
    return {
      ok: true,
      exportId,
      state,
      closingCount: parsed.cash_point_closings?.length ?? 0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "dsfinvk_export_trigger_failed",
    };
  }
}

export async function getDsfinvkExportStatus(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  exportId: string;
}): Promise<
  | { ok: true; state: string; closingCount: number }
  | { ok: false; error: string; state?: string }
> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const res = await fetch(`${base}/exports/${params.exportId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: formatDsfinvkHttpError(res.status, bodyText),
      };
    }

    const parsed = JSON.parse(bodyText || "{}") as DsfinvkExportResource;
    const state = normalizeExportState(parsed.state);

    if (
      state === "ERROR" ||
      state === "CANCELLED" ||
      state === "EXPIRED" ||
      state === "DELETED"
    ) {
      return {
        ok: false,
        error: parsed.error?.message ?? `export_${state.toLowerCase()}`,
        state,
      };
    }

    return {
      ok: true,
      state,
      closingCount: parsed.cash_point_closings?.length ?? 0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "dsfinvk_export_status_failed",
    };
  }
}

export async function waitForDsfinvkExport(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  exportId: string;
  maxAttempts?: number;
  delayMs?: number;
}): Promise<DsfinvkExportPollResult> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);
  const maxAttempts = params.maxAttempts ?? 45;
  const delayMs = params.delayMs ?? 1000;

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const res = await fetch(`${base}/exports/${params.exportId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });

      const bodyText = await res.text();
      if (!res.ok) {
        return {
          ok: false,
          error: formatDsfinvkHttpError(res.status, bodyText),
        };
      }

      const parsed = JSON.parse(bodyText || "{}") as DsfinvkExportResource;
      const state = normalizeExportState(parsed.state);

      if (state === "COMPLETED") {
        return { ok: true, state };
      }
      if (
        state === "ERROR" ||
        state === "CANCELLED" ||
        state === "EXPIRED" ||
        state === "DELETED"
      ) {
        return {
          ok: false,
          error: parsed.error?.message ?? `export_${state.toLowerCase()}`,
          state,
        };
      }

      if (attempt < maxAttempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { ok: false, error: "dsfinvk_export_timeout", state: "PENDING" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "dsfinvk_export_poll_failed",
    };
  }
}

/** YYYY-MM-DD in restaurant timezone (Loyaro: business_date on closing). */
export function exportBusinessDate(
  iso: string,
  timeZone = "Europe/Berlin",
): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(iso));
}

const LOYARO_EXPORT_PREPARE_MS = 3_000;

/**
 * Loyaro pattern: trigger export → short fixed wait → download directly.
 * Falls back to status polling only if the first download fails.
 */
export async function fetchDsfinvkExportZip(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  businessDate: string;
  exportId?: string;
}): Promise<
  | { ok: true; exportId: string; buffer: Buffer }
  | { ok: false; error: string; exportId?: string }
> {
  const exportId = params.exportId ?? crypto.randomUUID();

  const triggered = await triggerDsfinvkExport({
    dsfinvkBaseUrl: params.dsfinvkBaseUrl,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    clientId: params.clientId,
    dateFrom: params.businessDate,
    dateTo: params.businessDate,
    filter: "business",
    exportId,
  });

  if (!triggered.ok) {
    return { ok: false, error: triggered.error, exportId };
  }

  if (triggered.state === "COMPLETED") {
    const immediate = await downloadDsfinvkExport({
      dsfinvkBaseUrl: params.dsfinvkBaseUrl,
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      exportId,
    });
    if (immediate.ok) {
      return { ok: true, exportId, buffer: immediate.buffer };
    }
  }

  await new Promise((resolve) => setTimeout(resolve, LOYARO_EXPORT_PREPARE_MS));

  const firstTry = await downloadDsfinvkExport({
    dsfinvkBaseUrl: params.dsfinvkBaseUrl,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    exportId,
  });
  if (firstTry.ok) {
    return { ok: true, exportId, buffer: firstTry.buffer };
  }

  const waited = await waitForDsfinvkExport({
    dsfinvkBaseUrl: params.dsfinvkBaseUrl,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    exportId,
    maxAttempts: 30,
    delayMs: 2_000,
  });

  if (!waited.ok) {
    return { ok: false, error: waited.error, exportId };
  }

  const finalTry = await downloadDsfinvkExport({
    dsfinvkBaseUrl: params.dsfinvkBaseUrl,
    apiKey: params.apiKey,
    apiSecret: params.apiSecret,
    exportId,
  });

  if (!finalTry.ok) {
    return { ok: false, error: finalTry.error, exportId };
  }

  return { ok: true, exportId, buffer: finalTry.buffer };
}

type DsfinvkExportListItem = {
  _id?: string;
  state?: string;
  cash_point_closings?: string[];
};

export async function listDsfinvkExports(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  clientId: string;
  businessDateStart: string;
  businessDateEnd: string;
  states?: string;
  limit?: number;
}): Promise<
  | { ok: true; exports: DsfinvkExportListItem[] }
  | { ok: false; error: string }
> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const q = new URLSearchParams({
      client_id: params.clientId,
      business_date_start: params.businessDateStart,
      business_date_end: params.businessDateEnd,
      states: params.states ?? "COMPLETED",
      order_by: "time_completed",
      order: "desc",
      limit: String(params.limit ?? 20),
    });

    const res = await fetch(`${base}/exports?${q}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(30_000),
    });

    const bodyText = await res.text();
    if (!res.ok) {
      return {
        ok: false,
        error: formatDsfinvkHttpError(res.status, bodyText),
      };
    }

    const parsed = JSON.parse(bodyText || "{}") as { data?: DsfinvkExportListItem[] };
    return { ok: true, exports: parsed.data ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "dsfinvk_export_list_failed",
    };
  }
}

export async function downloadDsfinvkExport(params: {
  dsfinvkBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  exportId: string;
}): Promise<{ ok: true; buffer: Buffer } | { ok: false; error: string }> {
  const base = normalizeFiskalyDsfinvkBaseUrl(params.dsfinvkBaseUrl);

  try {
    const token = await fiskalyDsfinvkAuthToken(
      base,
      params.apiKey,
      params.apiSecret,
    );

    const res = await fetch(`${base}/exports/${params.exportId}/download`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(120_000),
    });

    if (!res.ok) {
      const bodyText = await res.text();
      return {
        ok: false,
        error: formatDsfinvkHttpError(res.status, bodyText),
      };
    }

    const arrayBuffer = await res.arrayBuffer();
    return { ok: true, buffer: Buffer.from(arrayBuffer) };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "dsfinvk_export_download_failed",
    };
  }
}
