import "server-only";

const DEFAULT_SIGN_DE_BASE_URL =
  "https://kassensichv-middleware.fiskaly.com/api/v2";

let cachedSignToken: { value: string; expiresAt: number } | null = null;

export function normalizeFiskalySignDeBaseUrl(url?: string): string {
  return (url?.trim() || DEFAULT_SIGN_DE_BASE_URL).replace(/\/$/, "");
}

/** Parse Fiskaly error JSON or plain text for health checks. */
export function formatFiskalyHttpError(status: number, body: string): string {
  const trimmed = body.trim();
  if (!trimmed) {
    return `Fiskaly SIGN DE HTTP ${status}`;
  }

  try {
    const parsed = JSON.parse(trimmed) as {
      code?: string;
      message?: string;
      error?: string;
    };
    const code = parsed.code ?? parsed.error;
    const message = parsed.message;
    if (code && message) {
      return `Fiskaly SIGN DE HTTP ${status}: ${code} — ${message}`;
    }
    if (code) {
      return `Fiskaly SIGN DE HTTP ${status}: ${code}`;
    }
    if (message) {
      return `Fiskaly SIGN DE HTTP ${status}: ${message}`;
    }
  } catch {
    // not JSON
  }

  const snippet =
    trimmed.length > 200 ? `${trimmed.slice(0, 200)}…` : trimmed;
  return `Fiskaly SIGN DE HTTP ${status}: ${snippet}`;
}

export async function fiskalyAuthToken(
  signBaseUrl: string,
  apiKey: string,
  apiSecret: string,
): Promise<string> {
  const now = Date.now();
  if (cachedSignToken && cachedSignToken.expiresAt - now > 60_000) {
    return cachedSignToken.value;
  }

  const base = normalizeFiskalySignDeBaseUrl(signBaseUrl);
  const res = await fetch(`${base}/auth`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ api_key: apiKey, api_secret: apiSecret }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(formatFiskalyHttpError(res.status, body));
  }

  const data = (await res.json()) as {
    access_token: string;
    access_token_expires_in: number;
  };

  cachedSignToken = {
    value: data.access_token,
    expiresAt: now + data.access_token_expires_in * 1000,
  };
  return data.access_token;
}

export function clearFiskalyAuthTokenCache(): void {
  cachedSignToken = null;
}

export type FiskalyAuthTestResult =
  | { ok: true; latencyMs: number }
  | { ok: false; message: string };

export async function testFiskalyAuth(params: {
  signDeBaseUrl: string;
  apiKey: string;
  apiSecret: string;
  fetchFn?: typeof fetch;
  signal?: AbortSignal;
}): Promise<FiskalyAuthTestResult> {
  const start = performance.now();
  const base = normalizeFiskalySignDeBaseUrl(params.signDeBaseUrl);
  const fetchFn = params.fetchFn ?? fetch;

  try {
    const res = await fetchFn(`${base}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: params.apiKey,
        api_secret: params.apiSecret,
      }),
      signal: params.signal,
    });

    if (!res.ok) {
      const body = await res.text();
      return { ok: false, message: formatFiskalyHttpError(res.status, body) };
    }

    return {
      ok: true,
      latencyMs: Math.round(performance.now() - start),
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Verbindung fehlgeschlagen";
    return { ok: false, message: msg };
  }
}
