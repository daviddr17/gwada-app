import type { AdyenPlatformEnv } from "@/lib/integrations/platform-adyen-config";

export const ADYEN_PLATFORM_NOT_READY_MESSAGE =
  "Gwada kann euch noch nicht zu Adyen weiterleiten. Die Plattform-API-Keys fehlen noch. Es wird nichts abgebucht.";

export const ADYEN_PLATFORM_DISABLED_MESSAGE =
  "Adyen ist noch nicht freigeschaltet. Es wird nichts abgebucht.";

export type AdyenConnectionSecrets = {
  status: string;
  env: string;
  legal_name: string | null;
  legal_entity_id: string | null;
  account_holder_id: string | null;
  balance_account_id: string | null;
  connected_at: string | null;
};

export type PublicPaymentAccountConnection = {
  status: "connected" | "disconnected";
  displayName: string | null;
  connectedAt: string | null;
};

export function adyenApiBases(env: AdyenPlatformEnv): {
  lem: string;
  balance: string;
} {
  if (env === "live") {
    return {
      lem: "https://kyc-live.adyen.com/lem/v4",
      balance: "https://balanceplatform-api-live.adyen.com/bcl/v2",
    };
  }
  return {
    lem: "https://kyc-test.adyen.com/lem/v4",
    balance: "https://balanceplatform-api-test.adyen.com/bcl/v2",
  };
}

/** Only a URL Adyen itself returned, on an Adyen host. */
export function adyenOnboardingRedirectUrl(raw: unknown): string | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const url = (raw as { url?: unknown }).url;
  if (typeof url !== "string" || !url.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    const adyenHost = host === "adyen.com" || host.endsWith(".adyen.com");
    if (parsed.protocol !== "https:" || !adyenHost) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

export function restaurantCountryIso2(
  countryIso2: string | null | undefined,
  country: string | null | undefined,
): string {
  const iso = (countryIso2 ?? "").trim().toUpperCase();
  if (/^[A-Z]{2}$/.test(iso)) return iso;
  const raw = (country ?? "").trim().toLowerCase();
  if (raw === "de" || raw === "deutschland" || raw === "germany") return "DE";
  if (raw === "at" || raw === "österreich" || raw === "osterreich" || raw === "austria") {
    return "AT";
  }
  if (raw === "ch" || raw === "schweiz" || raw === "switzerland") return "CH";
  if (raw === "nl" || raw === "niederlande" || raw === "netherlands") return "NL";
  if (/^[a-z]{2}$/.test(raw)) return raw.toUpperCase();
  return "DE";
}

/** Legal name only. Adyen ids stay on the server. */
export function publicAdyenConnection(
  row: AdyenConnectionSecrets | null,
): {
  status: "connected" | "disconnected";
  displayName: string | null;
  connectedAt: string | null;
} {
  const connected =
    row?.status === "connected" &&
    Boolean(row.legal_entity_id?.trim()) &&
    Boolean(row.account_holder_id?.trim()) &&
    Boolean(row.balance_account_id?.trim());
  if (!connected || !row) {
    return { status: "disconnected", displayName: null, connectedAt: null };
  }
  return {
    status: "connected",
    displayName: row.legal_name,
    connectedAt: row.connected_at,
  };
}
