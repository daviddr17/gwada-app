import "server-only";

export const LEXOFFICE_API_BASE = "https://api.lexware.io";

export type LexofficeTaxType = "net" | "gross" | "vatfree" | string;

export type LexofficeBusinessFeature =
  | "INVOICING"
  | "INVOICING_PRO"
  | "BOOKKEEPING"
  | string;

export type LexofficeProfile = {
  organizationId: string;
  companyName: string;
  taxType?: LexofficeTaxType;
  businessFeatures?: LexofficeBusinessFeature[];
  smallBusiness?: boolean;
  created?: {
    userName?: string;
    userEmail?: string;
    date?: string;
  };
};

const LEXOFFICE_FETCH_MAX_ATTEMPTS = 4;
const LEXOFFICE_FETCH_RETRY_BASE_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Lexware throttles burst requests (HTTP 429). Retry with backoff. */
export async function fetchLexofficeJson<T>(
  apiKey: string,
  path: string,
  init?: RequestInit,
): Promise<
  | { ok: true; data: T }
  | { ok: false; error: string; status?: number }
> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, error: "API-Key fehlt." };
  }

  let lastError = "Lexware API nicht erreichbar.";
  let lastStatus: number | undefined;

  for (let attempt = 0; attempt < LEXOFFICE_FETCH_MAX_ATTEMPTS; attempt += 1) {
    if (attempt > 0) {
      await sleep(LEXOFFICE_FETCH_RETRY_BASE_MS * 2 ** (attempt - 1));
    }

    let res: Response;
    try {
      res = await fetch(`${LEXOFFICE_API_BASE}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${trimmed}`,
          Accept: "application/json",
          ...(init?.method && init.method !== "GET"
            ? { "Content-Type": "application/json" }
            : {}),
          ...(init?.headers ?? {}),
        },
        cache: "no-store",
      });
    } catch {
      lastError = "Lexware API nicht erreichbar.";
      continue;
    }

    if (res.status === 429) {
      lastError = "Lexware API: Rate-Limit erreicht.";
      lastStatus = 429;
      continue;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return {
        ok: false,
        error: text || `Lexware API (${res.status})`,
        status: res.status,
      };
    }

    const data = (await res.json()) as T;
    return { ok: true, data };
  }

  return { ok: false, error: lastError, status: lastStatus };
}

export async function fetchLexofficeProfile(
  apiKey: string,
): Promise<
  | { ok: true; profile: LexofficeProfile }
  | { ok: false; error: string; status?: number }
> {
  const trimmed = apiKey.trim();
  if (!trimmed) {
    return { ok: false, error: "API-Key fehlt." };
  }

  let res: Response;
  try {
    res = await fetch(`${LEXOFFICE_API_BASE}/v1/profile`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${trimmed}`,
        Accept: "application/json",
      },
      cache: "no-store",
    });
  } catch {
    return { ok: false, error: "Lexware API nicht erreichbar." };
  }

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        error: "Ungültiger oder abgelaufener API-Key.",
        status: res.status,
      };
    }
    return {
      ok: false,
      error: `Lexware API (${res.status})`,
      status: res.status,
    };
  }

  const profile = (await res.json()) as LexofficeProfile;
  if (!profile.organizationId || !profile.companyName) {
    return { ok: false, error: "Unerwartete Antwort von Lexware." };
  }

  return { ok: true, profile };
}
