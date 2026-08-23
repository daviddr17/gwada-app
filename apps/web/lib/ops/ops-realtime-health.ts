/**
 * Aggregierter Realtime-Zustand für Ops-Status-Dot.
 * Liest aus dem Visibility-Coordinator (kein zweiter Subscribe-Stack).
 */

import { subscribeRestaurantRealtimeHealth } from "@/lib/supabase/restaurant-realtime-visibility-coordinator";

export type OpsRealtimeHealth = {
  /** Mindestens ein Kanal verbunden. */
  live: boolean;
  /** Registrierte Kanäle (0 = noch nichts / Proxy). */
  channelCount: number;
  /** Verbundene Kanäle. */
  connectedCount: number;
};

type Listener = () => void;

let snapshot: OpsRealtimeHealth = {
  live: false,
  channelCount: 0,
  connectedCount: 0,
};
const listeners = new Set<Listener>();
let unsubCoordinator: (() => void) | null = null;

function emit() {
  for (const l of listeners) l();
}

function ensureCoordinator() {
  if (unsubCoordinator || typeof window === "undefined") return;
  unsubCoordinator = subscribeRestaurantRealtimeHealth((next) => {
    snapshot = next;
    emit();
  });
}

export function getOpsRealtimeHealth(): OpsRealtimeHealth {
  ensureCoordinator();
  return snapshot;
}

export function subscribeOpsRealtimeHealth(listener: Listener): () => void {
  ensureCoordinator();
  listeners.add(listener);
  return () => listeners.delete(listener);
}
