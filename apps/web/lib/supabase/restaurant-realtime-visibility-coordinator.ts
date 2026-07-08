/**
 * Entlastet Main Thread bei Tab-Rückkehr und Erst-Load:
 * - Realtime bleibt bei kurzem Tab-Wechsel verbunden (kein Reconnect-Sturm)
 * - Nach längerer Inaktivität: gestaffelter Wiederaufbau statt 14× parallel
 */

const HIDDEN_TEARDOWN_MS = 45_000;
const SUBSCRIBE_STAGGER_MS = 40;

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
  hiddenTeardownTimer = setTimeout(() => {
    hiddenTeardownTimer = null;
    teardownAll();
  }, HIDDEN_TEARDOWN_MS);
}

function onDocumentVisible(): void {
  cancelHiddenTeardown();
  for (const sub of subscriptions) {
    if (tornDown || !sub.connected) {
      scheduleSubscribe(sub);
    }
  }
  tornDown = false;
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
