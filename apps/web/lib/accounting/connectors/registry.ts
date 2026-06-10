import "server-only";

import type {
  AccountingConnectorPublicInfo,
  AccountingConnectorKey,
} from "@/lib/accounting/connectors/connector-meta";
import {
  lexofficeAccountingConnector,
  noneAccountingConnector,
} from "@/lib/accounting/connectors/lexoffice-connector";
import type { AccountingConnector } from "@/lib/accounting/connectors/types";
import { connectorAutoSyncEnabled } from "@/lib/accounting/accounting-connector-settings";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { fetchRestaurantLexofficeApiKey } from "@/lib/supabase/restaurant-lexoffice-integration-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const CONNECTORS: Record<AccountingConnectorKey, AccountingConnector> = {
  none: noneAccountingConnector,
  lexoffice: lexofficeAccountingConnector,
};

export async function resolveAccountingConnectorKey(
  restaurantId: string,
): Promise<AccountingConnectorKey> {
  const key = await fetchRestaurantLexofficeApiKey(restaurantId);
  return key ? "lexoffice" : "none";
}

export async function getAccountingConnector(
  restaurantId: string,
): Promise<AccountingConnector> {
  const key = await resolveAccountingConnectorKey(restaurantId);
  return CONNECTORS[key];
}

export async function getAccountingConnectorForSalesCreate(
  restaurantId: string,
  syncToExternal: boolean,
): Promise<AccountingConnector> {
  if (!syncToExternal) {
    return noneAccountingConnector;
  }
  const connector = await getAccountingConnector(restaurantId);
  if (connector.key === "none") {
    throw new Error("Externe Buchhaltung ist nicht verbunden.");
  }
  return connector;
}

export async function getAccountingConnectorPublicInfo(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<AccountingConnectorPublicInfo> {
  const connector = await getAccountingConnector(restaurantId);
  const connected = await connector.isConfigured(restaurantId);
  const settings = await getAccountingSettings(sb, restaurantId);

  return {
    key: connector.key,
    connected,
    displayName: connector.displayName,
    source: connector.source,
    capabilities: connector.capabilities,
    autoSyncEnabled: connectorAutoSyncEnabled(
      settings.connector_settings,
      connector.key,
    ),
  };
}

export async function getAccountingConnectorForDocument(
  restaurantId: string,
  documentSource: import("@/lib/types/accounting").AccountingSource,
): Promise<AccountingConnector> {
  const connector = await getAccountingConnector(restaurantId);
  if (documentSource === "gwada") {
    return noneAccountingConnector;
  }
  if (connector.source === documentSource) {
    return connector;
  }
  return noneAccountingConnector;
}
