import "server-only";

import { platformApiFetchSignal } from "@/lib/integrations/platform-api-timeout";

export const MOLLIE_API_BASE = "https://api.mollie.com/v2";

export type MollieAuth =
  | { kind: "api_key"; apiKey: string }
  | { kind: "oauth"; accessToken: string; testmode?: boolean };

export type MollieHttpResult<T> =
  | { ok: true; data: T; status: number }
  | { ok: false; error: string; status: number; detail?: string };

function authHeader(auth: MollieAuth): string {
  if (auth.kind === "api_key") return `Bearer ${auth.apiKey}`;
  return `Bearer ${auth.accessToken}`;
}

function withTestmodeQuery(path: string, auth: MollieAuth): string {
  if (auth.kind !== "oauth" || !auth.testmode) return path;
  const sep = path.includes("?") ? "&" : "?";
  return `${path}${sep}testmode=true`;
}

function withTestmodeBody(
  body: Record<string, unknown> | undefined,
  auth: MollieAuth,
): Record<string, unknown> | undefined {
  if (!body) return body;
  if (auth.kind === "oauth" && auth.testmode) {
    return { ...body, testmode: true };
  }
  return body;
}

export async function mollieFetchJson<T>(params: {
  auth: MollieAuth;
  method: "GET" | "POST" | "PATCH" | "DELETE";
  path: string;
  body?: Record<string, unknown>;
}): Promise<MollieHttpResult<T>> {
  const url = `${MOLLIE_API_BASE}${withTestmodeQuery(params.path, params.auth)}`;
  const init: RequestInit = {
    method: params.method,
    headers: {
      Authorization: authHeader(params.auth),
      Accept: "application/json",
      ...(params.body ? { "Content-Type": "application/json" } : {}),
    },
    cache: "no-store",
    signal: platformApiFetchSignal(),
  };
  if (params.body) {
    init.body = JSON.stringify(withTestmodeBody(params.body, params.auth));
  }

  const res = await fetch(url, init);
  const raw = (await res.json().catch(() => ({}))) as {
    detail?: string;
    title?: string;
    status?: number;
  } & T;

  if (!res.ok) {
    return {
      ok: false,
      error: "mollie_api_error",
      status: res.status,
      detail:
        typeof raw.detail === "string"
          ? raw.detail
          : typeof raw.title === "string"
            ? raw.title
            : undefined,
    };
  }

  return { ok: true, data: raw as T, status: res.status };
}
