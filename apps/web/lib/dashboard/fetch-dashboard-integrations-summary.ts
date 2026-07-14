import "server-only";

import {
  DASHBOARD_INTEGRATION_CHANNELS,
  type DashboardIntegrationChannelId,
  type DashboardIntegrationsSummary,
} from "@/lib/dashboard/dashboard-integration-channels";
import {
  smtpConfigFromJson,
  smtpConfigToPublic,
} from "@/lib/integrations/smtp-integration-config";
import { fetchPlatformMessagingFlags } from "@/lib/supabase/platform-messaging-db";
import type { SupabaseClient } from "@supabase/supabase-js";

const INTEGRATION_KEYS = DASHBOARD_INTEGRATION_CHANNELS.map((c) => c.id);

function platformEnabledForChannel(
  flags: Awaited<ReturnType<typeof fetchPlatformMessagingFlags>>,
  id: DashboardIntegrationChannelId,
): boolean {
  switch (id) {
    case "whatsapp":
      return flags.whatsappEnabled;
    case "email":
      return flags.emailEnabled;
    case "facebook":
      return flags.facebookEnabled;
    case "instagram":
      return flags.instagramEnabled;
    case "google_business":
      return flags.googleBusinessEnabled;
    case "lexoffice":
      return flags.lexofficeEnabled;
    case "tripadvisor":
      return flags.tripadvisorEnabled;
  }
}

function isChannelConnected(
  id: DashboardIntegrationChannelId,
  row: { integration_key: string; status: string; config: unknown } | undefined,
): boolean {
  if (!row) return false;
  switch (id) {
    case "whatsapp":
      return row.status === "working";
    case "facebook":
    case "instagram":
    case "google_business":
    case "lexoffice":
    case "tripadvisor":
      return row.status === "working";
    case "email": {
      if (row.status !== "custom") return false;
      const pub = smtpConfigToPublic(smtpConfigFromJson(row.config));
      return Boolean(pub.passwordConfigured);
    }
  }
}

export async function fetchDashboardIntegrationsSummary(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<DashboardIntegrationsSummary> {
  const [flags, { data: integrationRows, error }] = await Promise.all([
    fetchPlatformMessagingFlags(sb),
    sb
      .from("restaurant_integrations")
      .select("integration_key, status, config")
      .eq("restaurant_id", restaurantId)
      .in("integration_key", [...INTEGRATION_KEYS]),
  ]);

  if (error) {
    console.warn("fetchDashboardIntegrationsSummary", error.message);
  }

  const rowByKey = new Map(
    (integrationRows ?? []).map((r) => [
      r.integration_key as string,
      {
        integration_key: r.integration_key as string,
        status: r.status as string,
        config: r.config,
      },
    ]),
  );

  const items = DASHBOARD_INTEGRATION_CHANNELS.filter((ch) =>
    platformEnabledForChannel(flags, ch.id),
  ).map((ch) => ({
    ...ch,
    connected: isChannelConnected(ch.id, rowByKey.get(ch.id)),
  }));

  const connectedCount = items.filter((i) => i.connected).length;

  return {
    items,
    connectedCount,
    totalCount: items.length,
  };
}
