import { authorizeSocialNewsRestaurant } from "@/lib/social/route-auth";
import { resolveSocialSuggestionImageUrl } from "@/lib/social/social-asset-resolve-server";
import {
  SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
  SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
} from "@/lib/social/social-autopilot-bounds";
import { fetchSocialBrandKitFromDb } from "@/lib/social/social-brand-kit-db";
import { resolveSuggestionFeedLayout } from "@/lib/social/social-feed-layout";
import type { SocialSuggestionGenerateResult } from "@/lib/social/social-suggestion-generate-server";
import {
  listOpenSocialTasksFromDb,
  listSocialSuggestionsFromDb,
  pruneStaleHolidaySocialSuggestionsInDb,
} from "@/lib/social/social-suggestions-db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { fetchRestaurantAssistantRuntime } from "@/lib/supabase/restaurant-assistant-key-db";

export const dynamic = "force-dynamic";

async function peekSocialAutopilotAiStatus(
  restaurantId: string,
): Promise<SocialSuggestionGenerateResult> {
  const llm = await fetchRestaurantAssistantRuntime(restaurantId);
  const aiConfigured = Boolean(llm?.apiKey);
  return {
    created: 0,
    pending: 0,
    tasksCreated: false,
    aiConfigured,
    aiProvider: llm?.provider,
    skippedReason: aiConfigured ? undefined : "ai_not_configured",
    caps: {
      maxItemsPerRun: SOCIAL_AUTOPILOT_MAX_ITEMS_PER_RUN,
      maxLlmCalls: SOCIAL_AUTOPILOT_MAX_LLM_CALLS,
    },
  };
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = url.searchParams.get("restaurantId")?.trim() ?? "";

  const auth = await authorizeSocialNewsRestaurant(restaurantId);
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return Response.json({ error: "server_misconfigured" }, { status: 503 });
  }

  // Nur Status + bestehende Drafts — kein Blind-Generate mehr bei refresh.
  const generation = await peekSocialAutopilotAiStatus(restaurantId);

  // Historische Feiertags-Duplikate soft-skippen, bevor die Liste gelesen wird.
  await pruneStaleHolidaySocialSuggestionsInDb(admin, restaurantId);

  const [rawSuggestions, rawSaved, tasks, kit] = await Promise.all([
    listSocialSuggestionsFromDb(admin, restaurantId, {
      statuses: ["pending", "needs_asset", "approved"],
      limit: 40,
    }),
    listSocialSuggestionsFromDb(admin, restaurantId, {
      statuses: ["saved"],
      limit: 24,
    }),
    listOpenSocialTasksFromDb(admin, restaurantId),
    fetchSocialBrandKitFromDb(admin, restaurantId),
  ]);

  const mapSuggestion = async (
    s: (typeof rawSuggestions)[number],
  ) => {
    const imageUrl = await resolveSocialSuggestionImageUrl(
      admin,
      restaurantId,
      s.asset,
    );
    return {
      ...s,
      feedLayout: resolveSuggestionFeedLayout({
        slotKind: s.slotKind,
        templateId: s.templateId,
        source: s.source,
        preferredLayouts: kit.preferredLayouts,
      }),
      asset: { ...s.asset, imageUrl },
    };
  };

  const [suggestions, saved] = await Promise.all([
    Promise.all(rawSuggestions.map(mapSuggestion)),
    Promise.all(rawSaved.map(mapSuggestion)),
  ]);

  return Response.json({
    suggestions,
    saved,
    tasks,
    generation,
  });
}
