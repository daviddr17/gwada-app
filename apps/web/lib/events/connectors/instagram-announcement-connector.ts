import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import { buildEventAnnouncementBody } from "@/lib/events/format-events-display-date";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadFeed: false,
  canCreateEvent: true,
  canUpdateEvent: false,
  canDeleteEvent: false,
  isAnnouncementOnly: true,
  maxCoverCount: 1,
} as const;

async function getIgAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "instagram",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "instagram_not_connected" as const };
  const igId = row.config.instagram_business_account_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!igId || !token) return { error: "instagram_token_missing" as const };
  return { igId, token };
}

export const instagramEventsAnnouncementConnector: EventsPlatformConnector = {
  key: "instagram",
  displayName: "Instagram",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getIgAuth(restaurantId);
    return !("error" in auth);
  },
  async fetchFeed() {
    return { items: [] };
  },
  async publishEvent(restaurantId, _sb, input) {
    const auth = await getIgAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "instagram_not_connected" };
    if (!input.coverUrl) {
      return { ok: false, error: "instagram_requires_cover" };
    }
    const caption = buildEventAnnouncementBody({
      title: input.title,
      description: input.description,
      startAt: input.startAt,
      endAt: input.endAt,
      ticketUrl: input.ticketUrl,
      location: input.location,
    });
    const createUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}/media`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ image_url: input.coverUrl, caption }),
      cache: "no-store",
    });
    const createBody = (await createRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!createRes.ok || !createBody.id) {
      return { ok: false, error: createBody.error?.message ?? "instagram_media_failed" };
    }
    const publishUrl = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.igId}/media_publish`;
    const publishRes = await fetch(publishUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ creation_id: createBody.id }),
      cache: "no-store",
    });
    const publishBody = (await publishRes.json()) as {
      id?: string;
      error?: { message?: string };
    };
    if (!publishRes.ok) {
      return { ok: false, error: publishBody.error?.message ?? "instagram_publish_failed" };
    }
    return {
      ok: true,
      externalId: publishBody.id ?? createBody.id ?? null,
      externalUrl: null,
      publishedAt: new Date().toISOString(),
    };
  },
  externalEditUrl() {
    return "https://www.instagram.com/";
  },
};
