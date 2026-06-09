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
