"use client";

import { getModuleCacheStaleTime } from "@/lib/dashboard/module-data-cache-policy";

const CACHE_PREFIX = "gwada:channel-connections:";
const DEFAULT_TTL_MS = getModuleCacheStaleTime("channelConnections") ?? 90_000;

export type CachedChannelConnections = {
  whatsappEnabled: boolean;
  emailEnabled: boolean;
  facebookEnabled: boolean;
  instagramEnabled: boolean;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
  staffInviteEmailAvailable: boolean;
};

type CachedPayload = {
  at: number;
  data: CachedChannelConnections;
};

function cacheKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekChannelConnectionsCache(
  restaurantId: string,
  maxAgeMs = DEFAULT_TTL_MS,
): CachedChannelConnections | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(cacheKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedPayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

export function writeChannelConnectionsCache(
  restaurantId: string,
  data: CachedChannelConnections,
): void {
  if (typeof window === "undefined") return;
  try {
    const payload: CachedPayload = { at: Date.now(), data };
    sessionStorage.setItem(cacheKey(restaurantId), JSON.stringify(payload));
  } catch {
    /* quota */
  }
}

export function clearChannelConnectionsCache(restaurantId?: string): void {
  if (typeof window === "undefined") return;
  if (restaurantId) {
    sessionStorage.removeItem(cacheKey(restaurantId));
    return;
  }
  for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
    const key = sessionStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) sessionStorage.removeItem(key);
  }
}
