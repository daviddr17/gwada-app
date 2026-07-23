/**
 * Entlastet Main Thread bei Tab-Rückkehr und Erst-Load:
 * - Realtime bleibt bei kurzem Tab-Wechsel verbunden (kein Reconnect-Sturm)
 * - Nach längerer Inaktivität: gestaffelter Wiederaufbau statt parallel
 * - Resume erst nach Idle, damit Klicks vor dem Subscribe-Sturm kommen
 */

import { runWhenIdle } from "@/lib/ui/run-when-idle";

const HIDDEN_TEARDOWN_MS = 45_000;
const SUBSCRIBE_STAGGER_MS = 70;
const RESUME_IDLE_TIMEOUT_MS = 1_800;

export type RestaurantRealtimeSubscription = {
  channelName: string;
  subscribe: () => void;
  unsubscribe: () => void;
  connected: boolean;
};

const subscriptions = new Set<RestaurantRealtimeSubscription>();
const subscribeTimers = new Map<
  RestaurantRealtimeSubscription,
  ReturnType<typeof setTimeout>
>();

let hiddenTeardownTimer: ReturnType<typeof setTimeout> | null = null;
let resumeIdleCancel: (() => void) | null = null;
let tornDown = false;
let listenerRefCount = 0;
let listenerAttached = false;

function staggerDelayMs(channelName: string): number {
  let hash = 0;
  for (let i = 0; i < channelName.length; i++) {
    hash = (hash * 31 + channelName.charCodeAt(i)) >>> 0;
  }
  return (hash % 24) * SUBSCRIBE_STAGGER_MS;
}

function clearSubscribeTimer(sub: RestaurantRealtimeSubscription): void {
  const timer = subscribeTimers.get(sub);
  if (timer) {
    clearTimeout(timer);
    subscribeTimers.delete(sub);
  }
}

function cancelResumeIdle(): void {
  resumeIdleCancel?.();
  resumeIdleCancel = null;
}

function scheduleSubscribe(sub: RestaurantRealtimeSubscription): void {
  if (typeof document === "undefined" || document.visibilityState !== "visible") {
    return;
  }

  clearSubscribeTimer(sub);
  const timer = setTimeout(() => {
    subscribeTimers.delete(sub);
    if (typeof document === "undefined" || document.visibilityState !== "visible") {
      return;
    }
    sub.subscribe();
    sub.connected = true;
  }, staggerDelayMs(sub.channelName));
  subscribeTimers.set(sub, timer);
}

function teardownAll(): void {
  cancelResumeIdle();
  for (const sub of subscriptions) {
    clearSubscribeTimer(sub);
    if (sub.connected) {
      sub.unsubscribe();
      sub.connected = false;
    }
  }
  tornDown = true;
}

function cancelHiddenTeardown(): void {
  if (hiddenTeardownTimer) {
    clearTimeout(hiddenTeardownTimer);
    hiddenTeardownTimer = null;
  }
}

function onDocumentHidden(): void {
  cancelHiddenTeardown();
  cancelResumeIdle();
  hiddenTeardownTimer = setTimeout(() => {
    hiddenTeardownTimer = null;
    teardownAll();
  }, HIDDEN_TEARDOWN_MS);
}

function resumeSubscriptions(): void {
  if (typeof document === "undefined" || document.visibilityState !== "visible") {
    return;
  }
  for (const sub of subscriptions) {
    if (tornDown || !sub.connected) {
      scheduleSubscribe(sub);
    }
  }
  tornDown = false;
}

function onDocumentVisible(): void {
  cancelHiddenTeardown();
  cancelResumeIdle();

  // Sofort markieren, neue Registrierungen nicht als „tornDown“ behandeln.
  const needsResume =
    tornDown ||
    [...subscriptions].some((sub) => !sub.connected);

  if (!needsResume) {
    tornDown = false;
    return;
  }

  // Klicks/Paint vor dem Reconnect-Sturm.
  if ("requestIdleCallback" in window) {
    const id = window.requestIdleCallback(
      () => {
        resumeIdleCancel = null;
        resumeSubscriptions();
      },
      { timeout: RESUME_IDLE_TIMEOUT_MS },
    );
    resumeIdleCancel = () => window.cancelIdleCallback(id);
    return;
  }

  runWhenIdle(() => {
    resumeIdleCancel = null;
    resumeSubscriptions();
  }, RESUME_IDLE_TIMEOUT_MS);
}

function onVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    onDocumentHidden();
    return;
  }
  onDocumentVisible();
}

function attachVisibilityListener(): void {
  if (listenerAttached || typeof document === "undefined") return;
  listenerAttached = true;
  document.addEventListener("visibilitychange", onVisibilityChange);
}

function detachVisibilityListener(): void {
  if (!listenerAttached || listenerRefCount > 0) return;
  document.removeEventListener("visibilitychange", onVisibilityChange);
  listenerAttached = false;
}

export function registerRestaurantRealtimeSubscription(
  sub: RestaurantRealtimeSubscription,
): () => void {
  subscriptions.add(sub);
  listenerRefCount += 1;
  attachVisibilityListener();

  if (typeof document !== "undefined" && document.visibilityState === "visible") {
    scheduleSubscribe(sub);
  }

  return () => {
    subscriptions.delete(sub);
    listenerRefCount -= 1;
    clearSubscribeTimer(sub);
    sub.unsubscribe();
    sub.connected = false;
    detachVisibilityListener();
  };
}
