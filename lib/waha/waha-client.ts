import { wahaSessionWebhookConfig } from "@/lib/integrations/waha-webhook-url";
import type { WahaServerConfig } from "@/lib/waha/waha-config";
import type { WahaSessionStatus } from "@/lib/types/restaurant-integration";

export type WahaSessionPayload = {
  name?: string;
  status?: WahaSessionStatus;
  me?: {
    id?: string;
    pushName?: string;
    name?: string;
  } | null;
};

type WahaFetchResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number };

function sanitizeWahaError(error: string, config: WahaServerConfig): string {
  const key = config.apiKey;
  if (key && error.includes(key)) {
    return error.replaceAll(key, "***");
  }
  return error;
}

async function wahaFetch<T>(
  config: WahaServerConfig,
  path: string,
  init?: RequestInit,
): Promise<WahaFetchResult<T>> {
  const url = `${config.baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  headers.set("X-Api-Key", config.apiKey);
  if (!headers.has("Accept")) {
    headers.set("Accept", "application/json");
  }

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers, cache: "no-store" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "fetch_failed";
    return { ok: false, error: sanitizeWahaError(msg, config), status: 502 };
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let error = `waha_${res.status}`;
    if (contentType.includes("application/json")) {
      try {
        const body = (await res.json()) as { message?: string; error?: string };
        error = body.message ?? body.error ?? error;
      } catch {
        /* ignore */
      }
    }
    return {
      ok: false,
      error: sanitizeWahaError(error, config),
      status: res.status,
    };
  }

  if (contentType.includes("application/json")) {
    const data = (await res.json()) as T;
    return { ok: true, data, status: res.status };
  }

  const buffer = await res.arrayBuffer();
  return { ok: true, data: buffer as T, status: res.status };
}

export async function wahaGetSession(
  config: WahaServerConfig,
  sessionName: string,
): Promise<WahaFetchResult<WahaSessionPayload>> {
  return wahaFetch<WahaSessionPayload>(
    config,
    `/api/sessions/${encodeURIComponent(sessionName)}`,
  );
}

function sessionConfigForRestaurant(restaurantId: string): Record<string, unknown> {
  const webhook = wahaSessionWebhookConfig(restaurantId);
  return {
    noweb: {
      store: { enabled: true, fullSync: false },
    },
    ...(webhook
      ? {
          webhooks: webhook.webhooks,
          metadata: webhook.metadata,
        }
      : {
          metadata: {
            "gwada.restaurant_id": restaurantId,
          },
        }),
  };
}

export async function wahaCreateSession(
  config: WahaServerConfig,
  sessionName: string,
  restaurantId: string,
): Promise<WahaFetchResult<WahaSessionPayload>> {
  return wahaFetch<WahaSessionPayload>(config, "/api/sessions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: sessionName,
      start: true,
      config: sessionConfigForRestaurant(restaurantId),
    }),
  });
}

/** Webhook-URL an bestehende Session hängen (z. B. nach Deploy). */
export async function wahaUpdateSessionWebhooks(
  config: WahaServerConfig,
  sessionName: string,
  restaurantId: string,
): Promise<WahaFetchResult<WahaSessionPayload>> {
  return wahaFetch<WahaSessionPayload>(
    config,
    `/api/sessions/${encodeURIComponent(sessionName)}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        config: sessionConfigForRestaurant(restaurantId),
      }),
    },
  );
}

export async function wahaStartSession(
  config: WahaServerConfig,
  sessionName: string,
): Promise<WahaFetchResult<WahaSessionPayload>> {
  return wahaFetch<WahaSessionPayload>(
    config,
    `/api/sessions/${encodeURIComponent(sessionName)}/start`,
    { method: "POST" },
  );
}

export async function wahaRestartSession(
  config: WahaServerConfig,
  sessionName: string,
): Promise<WahaFetchResult<WahaSessionPayload>> {
  return wahaFetch<WahaSessionPayload>(
    config,
    `/api/sessions/${encodeURIComponent(sessionName)}/restart`,
    { method: "POST" },
  );
}

export async function wahaStopSession(
  config: WahaServerConfig,
  sessionName: string,
): Promise<WahaFetchResult<unknown>> {
  return wahaFetch(
    config,
    `/api/sessions/${encodeURIComponent(sessionName)}/stop`,
    { method: "POST" },
  );
}

export async function wahaLogoutSession(
  config: WahaServerConfig,
  sessionName: string,
): Promise<WahaFetchResult<unknown>> {
  return wahaFetch(config, "/api/sessions/logout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: sessionName }),
  });
}

export async function wahaGetQrBase64(
  config: WahaServerConfig,
  sessionName: string,
): Promise<
  WahaFetchResult<{ mimetype: string; data: string }> | { ok: false; error: string; status: number }
> {
  const url = `/api/${encodeURIComponent(sessionName)}/auth/qr?format=image`;
  const result = await wahaFetch<{ mimetype: string; data: string }>(config, url, {
    headers: { Accept: "application/json" },
  });
  return result;
}

export async function wahaRequestPairingCode(
  config: WahaServerConfig,
  sessionName: string,
  phoneNumber: string,
): Promise<WahaFetchResult<{ code: string }>> {
  return wahaFetch<{ code: string }>(
    config,
    `/api/${encodeURIComponent(sessionName)}/auth/request-code`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phoneNumber }),
    },
  );
}

export function mapWahaStatusToIntegration(
  wahaStatus: WahaSessionStatus | undefined,
): import("@/lib/types/restaurant-integration").RestaurantWhatsappStatus {
  switch (wahaStatus) {
    case "WORKING":
      return "working";
    case "SCAN_QR_CODE":
      return "scan_qr";
    case "STARTING":
      return "starting";
    case "FAILED":
      return "failed";
    case "STOPPED":
      return "stopped";
    default:
      return "starting";
  }
}

export type WahaCheckNumberExistsResult = {
  numberExists: boolean;
  chatId?: string;
};

export async function wahaCheckNumberExists(
  config: WahaServerConfig,
  sessionName: string,
  phoneDigits: string,
): Promise<
  | { ok: true; data: WahaCheckNumberExistsResult }
  | { ok: false; error: string }
> {
  const phone = phoneDigits.replace(/\D/g, "");
  if (phone.length < 8) {
    return { ok: false, error: "invalid_phone" };
  }
  return wahaFetch<WahaCheckNumberExistsResult>(
    config,
    `/api/contacts/check-exists?phone=${encodeURIComponent(phone)}&session=${encodeURIComponent(sessionName)}`,
  );
}
