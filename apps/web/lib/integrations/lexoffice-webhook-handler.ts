import "server-only";

import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getAccountingSettings } from "@/lib/accounting/accounting-settings-server";
import { lexofficeConnectorFeatures } from "@/lib/accounting/accounting-connector-settings";
import { runAccountingSync } from "@/lib/accounting/accounting-sync-handler";
import { syncLexofficeContactsCache } from "@/lib/contacts/lexoffice-contacts-sync-server";
import { importLexofficePdfToDocuments } from "@/lib/integrations/lexoffice-pdf-import-server";
import type { LexofficeWebhookPayload } from "@/lib/integrations/lexoffice-webhook-verify";
import { fetchLexofficeSalesDetail } from "@/lib/integrations/lexoffice-voucherlist";
import {
  fetchRestaurantLexofficeApiKey,
  fetchRestaurantIdByLexofficeOrganizationId,
} from "@/lib/supabase/restaurant-lexoffice-integration-db";

async function importSalesPdfIfEnabled(
  admin: SupabaseClient,
  restaurantId: string,
  kind: "invoice" | "quotation",
  resourceId: string,
): Promise<void> {
  const settings = await getAccountingSettings(admin, restaurantId);
  const { importPdfsToDocuments } = lexofficeConnectorFeatures(
    settings.connector_settings,
  );
  if (!importPdfsToDocuments) return;

  const detail = await fetchLexofficeSalesDetail(
    restaurantId,
    kind,
    resourceId,
    undefined,
    { skipCache: true },
  );
  const voucherNumber = detail.ok ? detail.detail.voucherNumber : null;
  const titlePrefix = kind === "invoice" ? "Rechnung" : "Angebot";

  await importLexofficePdfToDocuments(admin, {
    restaurantId,
    resourceType: kind,
    resourceId,
    title: voucherNumber
      ? `${titlePrefix} ${voucherNumber}`
      : `${titlePrefix} Lexware`,
    voucherNumber,
  });
}

async function handleLexofficeWebhookEvent(
  admin: SupabaseClient,
  restaurantId: string,
  payload: LexofficeWebhookPayload,
): Promise<void> {
  const event = payload.eventType;

  if (event.startsWith("contact.")) {
    const apiKey = await fetchRestaurantLexofficeApiKey(restaurantId);
    if (apiKey) {
      await syncLexofficeContactsCache(restaurantId, apiKey);
    }
    return;
  }

  if (
    event.startsWith("invoice.") ||
    event.startsWith("quotation.") ||
    event === "payment.changed"
  ) {
    const kind = event.startsWith("quotation") ? "quotation" : "invoice";
    if (event.startsWith("invoice.") || event.startsWith("quotation.")) {
      await runAccountingSync(admin, {
        restaurantId,
        userId: "",
        scope: "sales",
        kind,
        force: true,
      });
      if (
        event.includes(".created") ||
        event.includes(".changed") ||
        event.includes("status.changed")
      ) {
        await importSalesPdfIfEnabled(
          admin,
          restaurantId,
          kind,
          payload.resourceId,
        );
      }
    } else {
      await runAccountingSync(admin, {
        restaurantId,
        userId: "",
        scope: "sales",
        kind: "invoice",
        force: true,
      });
    }
    return;
  }

  if (event.startsWith("voucher.")) {
    await runAccountingSync(admin, {
      restaurantId,
      userId: "",
      scope: "vouchers",
      force: true,
    });
    const settings = await getAccountingSettings(admin, restaurantId);
    const { importPdfsToDocuments } = lexofficeConnectorFeatures(
      settings.connector_settings,
    );
    if (
      importPdfsToDocuments &&
      (event.includes(".created") || event.includes(".changed"))
    ) {
      await importLexofficePdfToDocuments(admin, {
        restaurantId,
        resourceType: "voucher",
        resourceId: payload.resourceId,
        title: `Beleg Lexware ${payload.resourceId.slice(0, 8)}`,
      });
    }
  }
}

export async function dispatchLexofficeWebhook(
  admin: SupabaseClient,
  payload: LexofficeWebhookPayload,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const restaurantId = await fetchRestaurantIdByLexofficeOrganizationId(
    payload.organizationId,
  );
  if (!restaurantId) {
    return { ok: false, error: "unknown_organization" };
  }

  after(async () => {
    try {
      await handleLexofficeWebhookEvent(admin, restaurantId, payload);
    } catch (e) {
      console.warn("[lexoffice] webhook handler", e);
    }
  });

  return { ok: true };
}

export async function importLexofficeSalesPdfAfterSync(
  _sb: SupabaseClient,
  params: {
    restaurantId: string;
    kind: "invoice" | "quotation";
    externalId: string;
    voucherNumber?: string | null;
  },
): Promise<void> {
  const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
  const admin = createSupabaseAdminClient();
  if (!admin) return;

  const settings = await getAccountingSettings(admin, params.restaurantId);
  const { importPdfsToDocuments } = lexofficeConnectorFeatures(
    settings.connector_settings,
  );
  if (!importPdfsToDocuments) return;

  const titlePrefix = params.kind === "invoice" ? "Rechnung" : "Angebot";
  await importLexofficePdfToDocuments(admin, {
    restaurantId: params.restaurantId,
    resourceType: params.kind,
    resourceId: params.externalId,
    title: params.voucherNumber
      ? `${titlePrefix} ${params.voucherNumber}`
      : `${titlePrefix} Lexware`,
    voucherNumber: params.voucherNumber,
  });
}
