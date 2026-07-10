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

export type LexofficeWebhookEnsureResult = {
  config: LexofficeIntegrationConfig;
  webhookWarning: string | null;
};

export async function ensureLexofficeWebhooksForRestaurant(
  sb: SupabaseClient,
  restaurantId: string,
  apiKey: string,
  existingConfig: LexofficeIntegrationConfig,
): Promise<LexofficeWebhookEnsureResult> {
  const settings = await getAccountingSettings(sb, restaurantId);
  const { useWebhooks } = lexofficeConnectorFeatures(settings.connector_settings);
  if (!useWebhooks) {
    return {
      config: {
        ...existingConfig,
        webhook_registration_warning: null,
      },
      webhookWarning: null,
    };
  }

  const callbackUrl = resolveLexofficeWebhookPublicUrl();
  if (!callbackUrl) {
    const warning =
      "Live-Webhooks konnten nicht registriert werden: öffentliche Callback-URL fehlt (NEXT_PUBLIC_APP_URL).";
    console.warn("[lexoffice] webhook URL nicht auflösbar");
    return {
      config: {
        ...existingConfig,
        webhook_registration_warning: warning,
      },
      webhookWarning: warning,
    };
  }

  const registered = await registerLexofficeWebhooksForRestaurant(
    apiKey,
    callbackUrl,
  );
  if (!registered.ok) {
    const warning = `Live-Webhooks konnten nicht registriert werden: ${registered.error}`;
    console.warn("[lexoffice] webhook registration", registered.error);
    return {
      config: {
        ...existingConfig,
        webhook_registration_warning: warning,
      },
      webhookWarning: warning,
    };
  }

  return {
    config: {
      ...existingConfig,
      webhook_subscription_ids: registered.subscriptionIds,
      webhook_registration_warning: null,
    },
    webhookWarning: null,
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
