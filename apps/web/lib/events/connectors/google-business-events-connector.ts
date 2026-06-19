import "server-only";

import type { EventsPlatformConnector } from "@/lib/events/connectors/types";
import type { UnifiedEventItem } from "@/lib/events/unified-event-item";
import {
  getGoogleBusinessAccessTokenForRestaurant,
  googleReviewsParentPath,
} from "@/lib/integrations/google-business-access";

const CAPABILITIES = {
  canReadFeed: true,
  canCreateEvent: true,
  canUpdateEvent: false,
  canDeleteEvent: true,
  isAnnouncementOnly: false,
  maxCoverCount: 1,
} as const;

type GoogleDate = { year?: number; month?: number; day?: number };
type GoogleTime = { hours?: number; minutes?: number };
type GoogleSchedule = {
  startDate?: GoogleDate;
  startTime?: GoogleTime;
  endDate?: GoogleDate;
  endTime?: GoogleTime;
};
type GoogleLocalPost = {
  name?: string;
  summary?: string;
  topicType?: string;
  createTime?: string;
  searchUrl?: string;
  media?: Array<{ googleUrl?: string }>;
  event?: {
    title?: string;
    schedule?: GoogleSchedule;
  };
  callToAction?: { actionType?: string; url?: string };
};

function googlePartsToIso(date?: GoogleDate, time?: GoogleTime): string | null {
  if (!date?.year || !date?.month || !date?.day) return null;
  const d = new Date(
    Date.UTC(
      date.year,
      date.month - 1,
      date.day,
      time?.hours ?? 0,
      time?.minutes ?? 0,
    ),
  );
  return d.toISOString();
}

function mapGoogleEventPost(post: GoogleLocalPost): UnifiedEventItem | null {
  if (post.topicType !== "EVENT") return null;
  const id = post.name?.split("/").pop() ?? post.name ?? "";
  const schedule = post.event?.schedule;
  const startAt =
    googlePartsToIso(schedule?.startDate, schedule?.startTime) ??
    post.createTime ??
    new Date().toISOString();
  const endAt = googlePartsToIso(schedule?.endDate, schedule?.endTime);
  const ticketUrl =
    post.callToAction?.actionType === "BOOK" || post.callToAction?.actionType === "LEARN_MORE"
      ? post.callToAction.url ?? null
      : null;
  return {
    id: `google_business:${id}`,
    platform: "google_business",
    source: "external",
    eventId: null,
    title: post.event?.title?.trim() || post.summary?.trim()?.split("\n")[0] || "Event",
    description: post.summary?.trim() ?? "",
    coverUrl: post.media?.[0]?.googleUrl ?? null,
    coverStoragePath: null,
    startAt,
    endAt,
    ticketUrl,
    location: null,
    status: "published",
    canEdit: false,
    canDelete: true,
    externalUrl: post.searchUrl ?? null,
    createdAt: post.createTime ?? startAt,
    publishedAt: post.createTime ?? null,
  };
}

async function getGoogleLocation(restaurantId: string) {
  const auth = await getGoogleBusinessAccessTokenForRestaurant(restaurantId);
  if ("error" in auth) return { error: auth.error as string };
  const parent = googleReviewsParentPath(auth.config);
  if (!parent) return { error: "google_location_missing" };
  return { accessToken: auth.accessToken, parent };
}

function isoToGoogleParts(iso: string): { date: GoogleDate; time: GoogleTime } {
  const d = new Date(iso);
  return {
    date: {
      year: d.getUTCFullYear(),
      month: d.getUTCMonth() + 1,
      day: d.getUTCDate(),
    },
    time: {
      hours: d.getUTCHours(),
      minutes: d.getUTCMinutes(),
    },
  };
}

export const googleBusinessEventsConnector: EventsPlatformConnector = {
  key: "google_business",
  displayName: "Google Business",
  capabilities: CAPABILITIES,
  async isConnected(restaurantId) {
    const auth = await getGoogleLocation(restaurantId);
    return !("error" in auth);
  },
  async fetchFeed(restaurantId) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { error: auth.error ?? "google_not_connected" };
    const url = `https://mybusiness.googleapis.com/v4/${auth.parent}/localPosts`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    const body = (await res.json()) as {
      localPosts?: GoogleLocalPost[];
      error?: { message?: string };
    };
    if (!res.ok) {
      return { error: body.error?.message ?? `google_local_posts_${res.status}` };
    }
    const items = (body.localPosts ?? [])
      .map(mapGoogleEventPost)
      .filter((item): item is UnifiedEventItem => item != null);
    return { items };
  },
  async publishEvent(restaurantId, _sb, input) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "google_not_connected" };
    const start = isoToGoogleParts(input.startAt);
    const end = input.endAt ? isoToGoogleParts(input.endAt) : null;
    const payload: Record<string, unknown> = {
      languageCode: "de",
      summary: [input.title, input.description].filter(Boolean).join("\n\n"),
      topicType: "EVENT",
      event: {
        title: input.title,
        schedule: {
          startDate: start.date,
          startTime: start.time,
          endDate: end?.date ?? start.date,
          endTime: end?.time ?? start.time,
        },
      },
    };
    if (input.coverUrl) {
      payload.media = [{ mediaFormat: "PHOTO", sourceUrl: input.coverUrl }];
    }
    if (input.ticketUrl) {
      payload.callToAction = { actionType: "LEARN_MORE", url: input.ticketUrl };
    }
    const url = `https://mybusiness.googleapis.com/v4/${auth.parent}/localPosts`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = (await res.json()) as GoogleLocalPost & { error?: { message?: string } };
    if (!res.ok) {
      return { ok: false, error: body.error?.message ?? `google_publish_${res.status}` };
    }
    const externalId = body.name?.split("/").pop() ?? body.name ?? null;
    return {
      ok: true,
      externalId,
      externalUrl: body.searchUrl ?? null,
      publishedAt: body.createTime ?? new Date().toISOString(),
    };
  },
  async deleteEvent(restaurantId, _sb, externalId) {
    const auth = await getGoogleLocation(restaurantId);
    if ("error" in auth) return { ok: false, error: auth.error ?? "google_not_connected" };
    const name = externalId.includes("/") ? externalId : `${auth.parent}/localPosts/${externalId}`;
    const url = `https://mybusiness.googleapis.com/v4/${name}`;
    const res = await fetch(url, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${auth.accessToken}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const body = (await res.json()) as { error?: { message?: string } };
      return { ok: false, error: body.error?.message ?? "google_delete_failed" };
    }
    return { ok: true };
  },
  externalEditUrl() {
    return "https://business.google.com/";
  },
};
