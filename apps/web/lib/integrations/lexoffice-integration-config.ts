import type {
  LexofficeBusinessFeature,
  LexofficeTaxType,
} from "@/lib/integrations/lexoffice-api";

export type LexofficeIntegrationConfig = {
  api_key?: string;
  api_key_configured?: boolean;
  organization_id?: string;
  company_name?: string;
  tax_type?: LexofficeTaxType;
  business_features?: LexofficeBusinessFeature[];
  connected_user_name?: string;
  connected_user_email?: string;
  /** eventType → subscription id (Lexware event-subscriptions). */
  webhook_subscription_ids?: Record<string, string>;
};

export type LexofficeIntegrationConfigPublic = {
  api_key_configured: boolean;
  organization_id: string | null;
  company_name: string | null;
  tax_type: LexofficeTaxType | null;
  business_features: LexofficeBusinessFeature[];
  connected_user_name: string | null;
  connected_user_email: string | null;
};

function parseLexofficeWebhookSubscriptionIds(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const ids: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string" && value.trim().length > 0) {
      ids[key] = value;
    }
  }
  return Object.keys(ids).length > 0 ? ids : undefined;
}

export function lexofficeConfigFromJson(raw: unknown): LexofficeIntegrationConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o = raw as Record<string, unknown>;
  const businessFeatures = Array.isArray(o.business_features)
    ? o.business_features.filter((f): f is LexofficeBusinessFeature => typeof f === "string")
    : undefined;
  return {
    api_key: typeof o.api_key === "string" ? o.api_key : undefined,
    api_key_configured:
      typeof o.api_key_configured === "boolean" ? o.api_key_configured : undefined,
    organization_id:
      typeof o.organization_id === "string" ? o.organization_id : undefined,
    company_name: typeof o.company_name === "string" ? o.company_name : undefined,
    tax_type: typeof o.tax_type === "string" ? o.tax_type : undefined,
    business_features: businessFeatures,
    connected_user_name:
      typeof o.connected_user_name === "string" ? o.connected_user_name : undefined,
    connected_user_email:
      typeof o.connected_user_email === "string" ? o.connected_user_email : undefined,
    webhook_subscription_ids: parseLexofficeWebhookSubscriptionIds(
      o.webhook_subscription_ids,
    ),
  };
}

export function lexofficeConfigToPublic(
  config: LexofficeIntegrationConfig,
): LexofficeIntegrationConfigPublic {
  const apiKeyConfigured = Boolean(config.api_key?.trim()) || Boolean(config.api_key_configured);
  return {
    api_key_configured: apiKeyConfigured,
    organization_id: config.organization_id ?? null,
    company_name: config.company_name ?? null,
    tax_type: config.tax_type ?? null,
    business_features: config.business_features ?? [],
    connected_user_name: config.connected_user_name ?? null,
    connected_user_email: config.connected_user_email ?? null,
  };
}

export function mergeLexofficeApiKey(
  existing: LexofficeIntegrationConfig,
  incoming: string,
): string {
  const trimmed = incoming.trim();
  if (trimmed) return trimmed;
  return existing.api_key?.trim() ?? "";
}

const TAX_TYPE_LABELS: Record<string, string> = {
  net: "Netto",
  gross: "Brutto",
  vatfree: "Ohne Umsatzsteuer",
};

const BUSINESS_FEATURE_LABELS: Record<string, string> = {
  INVOICING: "Rechnungen",
  INVOICING_PRO: "Rechnungen Pro",
  BOOKKEEPING: "Buchhaltung",
};

export function lexofficeTaxTypeLabel(taxType: string | null | undefined): string | null {
  if (!taxType) return null;
  return TAX_TYPE_LABELS[taxType] ?? taxType;
}

export function lexofficeBusinessFeatureLabel(feature: string): string {
  return BUSINESS_FEATURE_LABELS[feature] ?? feature;
}
