import {
  POS_LAN_HEADER_PROTOCOL,
  POS_LAN_HEADER_RESTAURANT_ID,
  POS_LAN_HUB_PORT,
  POS_LAN_PATHS,
  isPosLanHealthResponse,
  isPosLanHubSnapshot,
  posLanHubBaseUrl,
  type PosLanHealthResponse,
  type PosLanHubSnapshot,
} from "@gwada/pos-lan";

const HUB_FETCH_TIMEOUT_MS = 6_000;

export class PosHubClientError extends Error {
  code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

async function hubFetchJson(
  baseUrl: string,
  path: string,
  restaurantId?: string | null,
): Promise<unknown> {
  const url = `${baseUrl.replace(/\/$/, "")}${path}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), HUB_FETCH_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        [POS_LAN_HEADER_PROTOCOL]: "1",
        ...(restaurantId
          ? { [POS_LAN_HEADER_RESTAURANT_ID]: restaurantId }
          : {}),
      },
    });
    const body = (await res.json().catch(() => null)) as unknown;
    if (!res.ok) {
      throw new PosHubClientError(
        "hub_http_error",
        `Kasse antwortete mit HTTP ${res.status}.`,
      );
    }
    return body;
  } catch (err) {
    if (err instanceof PosHubClientError) throw err;
    if (err instanceof Error && err.name === "AbortError") {
      throw new PosHubClientError(
        "hub_timeout",
        "Zeitüberschreitung beim Abruf von der Kasse.",
      );
    }
    throw new PosHubClientError(
      "hub_unreachable",
      `Kasse nicht erreichbar (${baseUrl}). Gleiches WLAN?`,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function fetchPosHubHealth(
  baseUrl: string,
): Promise<PosLanHealthResponse> {
  const body = await hubFetchJson(baseUrl, POS_LAN_PATHS.health);
  if (!isPosLanHealthResponse(body)) {
    throw new PosHubClientError(
      "hub_invalid_health",
      "Ungültige Antwort von der Kasse (Health).",
    );
  }
  return body;
}

export async function fetchPosHubSnapshot(
  baseUrl: string,
  restaurantId?: string | null,
): Promise<PosLanHubSnapshot> {
  const body = await hubFetchJson(
    baseUrl,
    POS_LAN_PATHS.snapshot,
    restaurantId,
  );
  if (!isPosLanHubSnapshot(body)) {
    throw new PosHubClientError(
      "hub_invalid_snapshot",
      "Ungültiger Snapshot von der Kasse.",
    );
  }
  return body;
}

export function hubBaseUrlFromHost(
  host: string,
  port = POS_LAN_HUB_PORT,
): string {
  return posLanHubBaseUrl(host, port);
}
