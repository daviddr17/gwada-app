"use client";

const CACHE_PREFIX = "gwada:reviews-channels:";
const MAX_AGE_MS = 90_000;

export type ReviewsChannelsCachePayload = {
  at: number;
  googleConnected: boolean;
  facebookConnected: boolean;
  tripadvisorConnected: boolean;
  googleVisible: boolean;
  facebookVisible: boolean;
  tripadvisorVisible: boolean;
};

const memory = new Map<string, ReviewsChannelsCachePayload>();

function storageKey(restaurantId: string): string {
  return `${CACHE_PREFIX}${restaurantId}`;
}

export function peekReviewsChannelsCache(
  restaurantId: string,
  maxAgeMs = MAX_AGE_MS,
): ReviewsChannelsCachePayload | null {
  const fromMemory = memory.get(restaurantId);
  if (fromMemory && Date.now() - fromMemory.at <= maxAgeMs) {
    return fromMemory;
  }

  if (typeof window === "undefined") return fromMemory ?? null;

  try {
    const raw = sessionStorage.getItem(storageKey(restaurantId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ReviewsChannelsCachePayload;
    if (Date.now() - parsed.at > maxAgeMs) return null;
    memory.set(restaurantId, parsed);
    return parsed;
  } catch {
    return fromMemory ?? null;
  }
}

export function writeReviewsChannelsCache(
  restaurantId: string,
  payload: Omit<ReviewsChannelsCachePayload, "at">,
): void {
  const entry: ReviewsChannelsCachePayload = { at: Date.now(), ...payload };
  memory.set(restaurantId, entry);
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(storageKey(restaurantId), JSON.stringify(entry));
  } catch {
    /* quota */
  }
}
