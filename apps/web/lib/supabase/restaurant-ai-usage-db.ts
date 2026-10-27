import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type RestaurantAiUsageSource =
  | "autopilot"
  | "assistant"
  | "brand_learn";

export type RestaurantAiUsageEvent = {
  id: string;
  restaurantId: string;
  source: RestaurantAiUsageSource;
  provider: string;
  model: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  meta: Record<string, unknown>;
  createdAt: string;
};

export type RestaurantAiUsageSummary = {
  /** Events in den letzten 30 Tagen. */
  events30d: number;
  /** Summe total_tokens (nur wenn Provider sie liefert). */
  tokens30d: number | null;
  /** Letzte Events für die UI. */
  recent: RestaurantAiUsageEvent[];
};

export async function insertRestaurantAiUsageEvent(
  sb: SupabaseClient,
  params: {
    restaurantId: string;
    source: RestaurantAiUsageSource;
    provider: string;
    model?: string;
    promptTokens?: number | null;
    completionTokens?: number | null;
    totalTokens?: number | null;
    meta?: Record<string, unknown>;
  },
): Promise<void> {
  if (!isUuidRestaurantId(params.restaurantId)) return;
  const { error } = await sb.from("restaurant_ai_usage_events").insert({
    restaurant_id: params.restaurantId,
    source: params.source,
    provider: params.provider.slice(0, 40),
    model: (params.model ?? "").slice(0, 80),
    prompt_tokens: params.promptTokens ?? null,
    completion_tokens: params.completionTokens ?? null,
    total_tokens: params.totalTokens ?? null,
    meta: params.meta ?? {},
  });
  if (error) {
    console.warn("[gwada] insertRestaurantAiUsageEvent", error.message);
  }
}

function mapRow(row: Record<string, unknown>): RestaurantAiUsageEvent | null {
  const id = typeof row.id === "string" ? row.id : "";
  const restaurantId =
    typeof row.restaurant_id === "string" ? row.restaurant_id : "";
  if (!id || !restaurantId) return null;
  const source =
    row.source === "autopilot" ||
    row.source === "assistant" ||
    row.source === "brand_learn"
      ? row.source
      : "autopilot";
  return {
    id,
    restaurantId,
    source,
    provider: typeof row.provider === "string" ? row.provider : "",
    model: typeof row.model === "string" ? row.model : "",
    promptTokens:
      typeof row.prompt_tokens === "number" ? row.prompt_tokens : null,
    completionTokens:
      typeof row.completion_tokens === "number"
        ? row.completion_tokens
        : null,
    totalTokens:
      typeof row.total_tokens === "number" ? row.total_tokens : null,
    meta:
      row.meta && typeof row.meta === "object"
        ? (row.meta as Record<string, unknown>)
        : {},
    createdAt:
      typeof row.created_at === "string"
        ? row.created_at
        : new Date().toISOString(),
  };
}

export async function fetchRestaurantAiUsageSummary(
  sb: SupabaseClient,
  restaurantId: string,
  opts?: { recentLimit?: number },
): Promise<RestaurantAiUsageSummary> {
  if (!isUuidRestaurantId(restaurantId)) {
    return { events30d: 0, tokens30d: null, recent: [] };
  }
  const since = new Date();
  since.setDate(since.getDate() - 30);
  const recentLimit = opts?.recentLimit ?? 8;

  const { data, error } = await sb
    .from("restaurant_ai_usage_events")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .gte("created_at", since.toISOString())
    .order("created_at", { ascending: false })
    .limit(200);

  if (error) {
    console.warn("[gwada] fetchRestaurantAiUsageSummary", error.message);
    return { events30d: 0, tokens30d: null, recent: [] };
  }

  const events = (data ?? [])
    .map((row) => mapRow(row as Record<string, unknown>))
    .filter((x): x is RestaurantAiUsageEvent => x != null);

  let tokenSum = 0;
  let hasTokens = false;
  for (const e of events) {
    if (typeof e.totalTokens === "number" && e.totalTokens > 0) {
      tokenSum += e.totalTokens;
      hasTokens = true;
    }
  }

  return {
    events30d: events.length,
    tokens30d: hasTokens ? tokenSum : null,
    recent: events.slice(0, recentLimit),
  };
}
