import {
  DEFAULT_RESTAURANT_ID,
  createDefaultRestaurant,
} from "@/lib/constants/restaurant-profile";
import { mergeRestaurantProfile } from "@/lib/restaurant/profile-utils";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type {
  RestaurantPersistenceV1,
  RestaurantProfile,
} from "@/lib/types/restaurant";

const LEGACY_PROFILE_KEYS = [DEFAULT_RESTAURANT_ID, "default"] as const;

function profileScore(p: RestaurantProfile): number {
  let score = 0;
  const name = p.name.trim();
  if (name && name !== "Mein Restaurant") score += 20;
  if (p.street.trim()) score += 2;
  if (p.postalCode.trim()) score += 1;
  if (p.city.trim()) score += 1;
  if (p.phone.trim()) score += 2;
  if (p.website.trim()) score += 1;
  return score;
}

function pickSourceProfile(
  store: RestaurantPersistenceV1,
  workspaceId: string,
): RestaurantProfile | null {
  const candidates: RestaurantProfile[] = [];
  const seen = new Set<string>();

  const push = (p: RestaurantProfile | undefined) => {
    if (!p || seen.has(p.id)) return;
    seen.add(p.id);
    candidates.push(p);
  };

  push(store.restaurants[workspaceId]);
  push(store.restaurants[store.selectedRestaurantId]);
  for (const key of LEGACY_PROFILE_KEYS) {
    push(store.restaurants[key]);
  }
  for (const p of Object.values(store.restaurants)) {
    push(p);
  }

  if (candidates.length === 0) return null;

  candidates.sort((a, b) => profileScore(b) - profileScore(a));
  return candidates[0] ?? null;
}

/** Profil unter Workspace-UUID führen; Daten von `default` / alter selectedId übernehmen. */
export function bindPersistenceToWorkspaceRestaurant(
  store: RestaurantPersistenceV1,
  workspaceId: string | null,
): RestaurantPersistenceV1 {
  if (!workspaceId || !isUuidRestaurantId(workspaceId)) {
    return store;
  }

  const source = pickSourceProfile(store, workspaceId);
  const merged = mergeRestaurantProfile(
    workspaceId,
    source ?? store.restaurants[workspaceId] ?? undefined,
  );
  const profile: RestaurantProfile = { ...merged, id: workspaceId };

  const restaurants = { ...store.restaurants, [workspaceId]: profile };

  return {
    version: 1,
    selectedRestaurantId: workspaceId,
    restaurants,
  };
}

export function persistenceNeedsWorkspaceBind(
  before: RestaurantPersistenceV1,
  after: RestaurantPersistenceV1,
): boolean {
  return (
    before.selectedRestaurantId !== after.selectedRestaurantId ||
    before.restaurants[after.selectedRestaurantId]?.id !==
      after.restaurants[after.selectedRestaurantId]?.id ||
    !before.restaurants[after.selectedRestaurantId]
  );
}

/** Name aus App-State-Payload (JSON unter `restaurant_app_state`). */
export function profileNameFromAppStatePayload(
  payload: unknown,
  restaurantId: string,
): string | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const root = payload as Record<string, unknown>;
  const restaurants = root.restaurants;
  if (!restaurants || typeof restaurants !== "object" || Array.isArray(restaurants)) {
    return null;
  }
  const map = restaurants as Record<string, unknown>;

  const readName = (key: string): string | null => {
    const entry = map[key];
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
    const name = (entry as { name?: unknown }).name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  };

  const selectedId =
    typeof root.selectedRestaurantId === "string"
      ? root.selectedRestaurantId
      : DEFAULT_RESTAURANT_ID;

  return (
    readName(restaurantId) ??
    readName(selectedId) ??
    readName(DEFAULT_RESTAURANT_ID) ??
    readName("default")
  );
}

export function emptyWorkspacePersistence(
  workspaceId: string,
): RestaurantPersistenceV1 {
  return {
    version: 1,
    selectedRestaurantId: workspaceId,
    restaurants: {
      [workspaceId]: createDefaultRestaurant(workspaceId),
    },
  };
}
