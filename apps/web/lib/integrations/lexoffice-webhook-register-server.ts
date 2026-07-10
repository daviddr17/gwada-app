import "server-only";

import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { lexofficeConnectorFeatures } from "@/lib/accounting/accounting-connector-settings";
import {
  registerLexofficeWebhooksForRestaurant,
  resolveLexofficeWebhookPublicUrl,
  unregisterLexofficeWebhooks,
} from "@/lib/integrations/lexoffice-event-subscriptions";
import type { LexofficeIntegrationConfig } from "@/lib/integrations/lexoffice-integration-config";
import type { SupabaseClient } from "@supabase/supabase-js";

export async function ensureLexofficeWebhooksForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  apiKey: string,
  existingConfig: LexofficeIntegrationConfig,
): Promise<LexofficeIntegrationConfig> {
  const settings = await getAccountingSettings(sb, restaurantId);
  const { useWebhooks } = lexofficeConnectorFeatures(settings.connector_settings);
  if (!useWebhooks) {
    return existingConfig;
  }

  const callbackUrl = resolveLexofficeWebhookPublicUrl();
  if (!callbackUrl) {
    console.warn("[lexoffice] webhook URL nicht auflösbar");
    return existingConfig;
  }

  const registered = await registerLexofficeWebhooksForRestaurant(
    apiKey,
    callbackUrl,
  );
  if (!registered.ok) {
    console.warn("[lexoffice] webhook registration", registered.error);
    return existingConfig;
  }

  return {
    ...existingConfig,
    webhook_subscription_ids: registered.subscriptionIds,
  };
}

export async function teardownLexofficeWebhooks(
  apiKey: string | null,
  config: LexofficeIntegrationConfig,
): Promise<void> {
  if (!apiKey?.trim()) return;
  const ids = config.webhook_subscription_ids;
  if (!ids || Object.keys(ids).length === 0) return;
  await unregisterLexofficeWebhooks(apiKey, ids);
}
