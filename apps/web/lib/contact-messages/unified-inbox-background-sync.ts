"use client";

import { useEffect, useRef } from "react";
import { shouldSkipInboxWarmAfterBatch } from "@/lib/dashboard/dashboard-batch-warm-coordinator";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import { fetchUnifiedInboxConversations } from "@/lib/contact-messages/unified-inbox-client";
import {
  isUnifiedInboxCacheFresh,
  peekUnifiedInboxCache,
  peekUnifiedInboxCacheAgeMs,
  UNIFIED_INBOX_STALE_MS,
} from "@/lib/contact-messages/unified-inbox-cache";
import type { ContactConversationPreview } from "@/lib/supabase/contact-messages-db";

/** Leises Nachladen im Hintergrund — nicht beim Tab-Wechsel erneut fetchen. */
export const UNIFIED_INBOX_BACKGROUND_POLL_MS = 5 * 60 * 1000;

/** Kurz warten, bis Dashboard-Inhalt sichtbar ist, dann Inbox wärmen. */
export const UNIFIED_INBOX_WARM_DELAY_MS = 400;

/** Hover/Tap auf Nachrichten — Soft-Nav Intent (ohne Channel-Flags am Call-Site). */
export const GWADA_UNIFIED_INBOX_WARM_INTENT_EVENT =
  "gwada:unified-inbox-warm-intent";

const LIVE_REFRESH_DEBOUNCE_MS = 3_000;

/** Intent-Warm: nutzt aktuelle Poll-Params vom Background-Sync-Mount. */
export function requestUnifiedInboxWarmIntent(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_UNIFIED_INBOX_WARM_INTENT_EVENT));
}

export type UnifiedInboxSyncParams = {
  restaurantId: string;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
};

let inflightRefresh: Promise<ContactConversationPreview[] | null> | null =
  null;
let inflightKey = "";

let pollerSubscribers = 0;
let pollerInterval: number | null = null;
let currentPollParams: UnifiedInboxSyncParams | null = null;

let liveDebounceTimer: number | null = null;

function paramsKey(params: UnifiedInboxSyncParams): string {
  return `${params.restaurantId}:${params.whatsappConnected}:${params.emailConnected}:${params.facebookConnected}:${params.instagramConnected}`;
}

export function getUnifiedInboxRefreshInflight():
  | Promise<ContactConversationPreview[] | null>
  | null {
  return inflightRefresh;
}

export async function refreshUnifiedInboxCache(
  params: UnifiedInboxSyncParams,
  options?: { force?: boolean },
): Promise<ContactConversationPreview[] | null> {
  const key = paramsKey(params);
  if (inflightRefresh && inflightKey === key && !options?.force) {
    return inflightRefresh;
  }

  inflightKey = key;
  inflightRefresh = (async () => {
    const { data, error } = await fetchUnifiedInboxConversations(params);
    if (error) return null;
    return data;
  })().finally(() => {
    inflightRefresh = null;
  });

  return inflightRefresh;
}

function registerPoller(params: UnifiedInboxSyncParams) {
  pollerSubscribers += 1;
  currentPollParams = params;
  if (pollerInterval) return;

  pollerInterval = window.setInterval(() => {
    if (document.visibilityState !== "visible" || !currentPollParams) return;
    void refreshUnifiedInboxCache(currentPollParams);
  }, UNIFIED_INBOX_BACKGROUND_POLL_MS);
}

function unregisterPoller() {
  pollerSubscribers = Math.max(0, pollerSubscribers - 1);
  if (pollerSubscribers > 0) return;
  if (pollerInterval) {
    window.clearInterval(pollerInterval);
    pollerInterval = null;
  }
  currentPollParams = null;
}

function scheduleLiveRefresh(params: UnifiedInboxSyncParams) {
  if (liveDebounceTimer) window.clearTimeout(liveDebounceTimer);
  liveDebounceTimer = window.setTimeout(() => {
    liveDebounceTimer = null;
    if (document.visibilityState !== "visible") return;
    void refreshUnifiedInboxCache(params, { force: true });
  }, LIVE_REFRESH_DEBOUNCE_MS);
}

function shouldWarmOnStart(restaurantId: string): boolean {
  const cached = peekUnifiedInboxCache(restaurantId);
  // Leerer Cache immer wärmen — Batch-Skip gilt nur gegen Doppel-Fetch, nicht gegen Kälte.
  if (!cached) return true;
  if (shouldSkipInboxWarmAfterBatch(restaurantId)) return false;
  const age = peekUnifiedInboxCacheAgeMs(restaurantId);
  if (age == null) return true;
  return age >= UNIFIED_INBOX_STALE_MS;
}

export function useUnifiedInboxBackgroundSync(options: {
  enabled: boolean;
  restaurantId: string | null;
  whatsappConnected: boolean;
  emailConnected: boolean;
  facebookConnected: boolean;
  instagramConnected: boolean;
  connectionsReady: boolean;
}): void {
  const {
    enabled,
    restaurantId,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
    connectionsReady,
  } = options;

  const params =
    restaurantId && connectionsReady
      ? {
          restaurantId,
          whatsappConnected,
          emailConnected,
          facebookConnected,
          instagramConnected,
        }
      : null;

  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;
  const paramsRef = useRef(params);
  paramsRef.current = params;

  useEffect(() => {
    if (!enabled || !params) return;

    const warmId = window.setTimeout(() => {
      if (!enabledRef.current || !paramsRef.current) return;
      if (!shouldWarmOnStart(paramsRef.current.restaurantId)) return;
      void refreshUnifiedInboxCache(paramsRef.current);
    }, UNIFIED_INBOX_WARM_DELAY_MS);

    const onLive = () => {
      if (!enabledRef.current || !paramsRef.current) return;
      scheduleLiveRefresh(paramsRef.current);
    };

    const onWarmIntent = () => {
      if (!enabledRef.current || !paramsRef.current) return;
      if (isUnifiedInboxCacheFresh(paramsRef.current.restaurantId)) return;
      void refreshUnifiedInboxCache(paramsRef.current);
    };

    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onLive);
    window.addEventListener(GWADA_UNIFIED_INBOX_WARM_INTENT_EVENT, onWarmIntent);
    registerPoller(params);

    return () => {
      window.clearTimeout(warmId);
      if (liveDebounceTimer) {
        window.clearTimeout(liveDebounceTimer);
        liveDebounceTimer = null;
      }
      window.removeEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onLive);
      window.removeEventListener(
        GWADA_UNIFIED_INBOX_WARM_INTENT_EVENT,
        onWarmIntent,
      );
      unregisterPoller();
    };
  }, [
    enabled,
    restaurantId,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
    connectionsReady,
    params,
  ]);
}
