import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import {
  oauthConfigFromJson,
  type MetaOAuthIntegrationConfig,
} from "@/lib/integrations/oauth-integration-types";
import { metaGraphListFetch } from "@/lib/news/connectors/meta-feed-fetch";
import { fetchRestaurantOAuthIntegrationAdmin } from "@/lib/supabase/restaurant-oauth-integration-db";

const CAPABILITIES = {
  canReadFeed: true,
  canCreateEvent: true,
  canUpdateEvent: false,
  canDeleteEvent: true,
  isAnnouncementOnly: false,
  maxCoverCount: 1,
} as const;

type FbEvent = {
  id?: string;
  name?: string;
  description?: string;
  start_time?: string;
  end_time?: string;
  ticket_uri?: string;
  cover?: { source?: string };
  place?: { name?: string };
};

async function getMetaAuth(restaurantId: string) {
  const row = await fetchRestaurantOAuthIntegrationAdmin(
    restaurantId,
    "facebook",
    (raw) => oauthConfigFromJson<MetaOAuthIntegrationConfig>(raw),
  );
  if (!row || row.status !== "working") return { error: "facebook_not_connected" as const };
  const pageId = row.config.page_id?.trim();
  const token = row.config.page_access_token?.trim();
  if (!pageId || !token) return { error: "facebook_token_missing" as const };
  return { pageId, token };
}

function mapFbEvent(event: FbEvent): UnifiedEventItem {
  const id = event.id ?? "";
  return {
    id: `facebook:${id}`,
    platform: "facebook",
    source: "external",
    eventId: null,
    title: event.name?.trim() ?? "Event",
    description: event.description?.trim() ?? "",
    coverUrl: event.cover?.source?.trim() ?? null,
    coverStoragePath: null,
    startAt: event.start_time ?? new Date().toISOString(),
    endAt: event.end_time ?? null,
    ticketUrl: event.ticket_uri?.trim() ?? null,
    location: event.place?.name?.trim() ?? null,
    status: "published",
    canEdit: false,
    canDelete: true,
    externalUrl: id ? `https://www.facebook.com/events/${id}` : null,
    createdAt: event.start_time ?? new Date().toISOString(),
    publishedAt: event.start_time ?? null,
  };
}

export const facebookEventsConnector: EventsPlatformConnector = {
  key: "facebook",
  displayName: "Facebook",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getMetaAuth(restaurantId);
    return !("error" in auth);
  },
  async fetchFeed(restaurantId) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "facebook_not_connected" };
    const fields = encodeURIComponent(
      "id,name,description,start_time,end_time,ticket_uri,cover,place",
    );
    const result = await metaGraphListFetch<FbEvent>({
      path: `${auth.pageId}/events?fields=${fields}&limit=50`,
      token: auth.token,
      context: { platform: "facebook", feature: "news" },
    });
    if (!result.ok) return { error: result.error };
    const items = result.data.map(mapFbEvent).filter((i) => i.title);
    return { items };
  },
  async publishEvent(restaurantId, _sb, input) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "facebook_not_connected" };
    const payload: Record<string, unknown> = {
      name: input.title,
      description: input.description,
      start_time: input.startAt,
      end_time: input.endAt ?? undefined,
      ticket_uri: input.ticketUrl ?? undefined,
    };
    if (input.coverUrl) payload.cover_url = input.coverUrl;
    if (input.location) {
      payload.place = input.location;
    }
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${auth.pageId}/events`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = (await res.json()) as { id?: string; error?: { message?: string } };
    if (!res.ok || !body.id) {
      return { ok: false, error: body.error?.message ?? `facebook_event_${res.status}` };
    }
    return {
      ok: true,
      externalId: body.id,
      externalUrl: `https://www.facebook.com/events/${body.id}`,
      publishedAt: new Date().toISOString(),
    };
  },
  async deleteEvent(restaurantId, _sb, externalId) {
    const auth = await getMetaAuth(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "facebook_not_connected" };
    const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${externalId}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      return { ok: false, error: body.error?.message ?? "facebook_delete_failed" };
    }
    return { ok: true };
  },
  externalEditUrl(_externalId) {
    return "https://www.facebook.com/";
  },
};
