import "server-only";

import { assistantAsk, assistantAskWhich } from "@/lib/assistant/assistant-ask";
import type { AssistantToolContext } from "@/lib/assistant/assistant-tool-context";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { AppLocale } from "@/i18n/config";
import type { SupabaseClient } from "@supabase/supabase-js";

export type AssistantTarget =
  | { kind: "one"; restaurantId: string; restaurantName: string | null; sb: SupabaseClient }
  | { kind: "all"; sb: SupabaseClient }
  | { kind: "ask"; ask: string };

function wantsAll(args: Record<string, unknown>): boolean {
  const scope = String(args.scope ?? "").trim().toLowerCase();
  const name = String(args.restaurant_name ?? args.restaurantName ?? "")
    .trim()
    .toLowerCase();
  return scope === "all" || name === "alle" || name === "all";
}

function namedHouse(args: Record<string, unknown>): string {
  return String(args.restaurant_name ?? args.restaurantName ?? "").trim();
}

async function restaurantName(
  sb: SupabaseClient,
  restaurantId: string,
): Promise<string | null> {
  const { data } = await sb
    .from("restaurants")
    .select("name")
    .eq("id", restaurantId)
    .maybeSingle();
  return typeof data?.name === "string" ? data.name : null;
}

async function searchRestaurants(
  sb: SupabaseClient,
  name: string,
): Promise<Array<{ id: string; name: string }>> {
  const q = name.replace(/[%_,]/g, "").trim();
  if (q.length < 2) return [];
  const { data, error } = await sb
    .from("restaurants")
    .select("id, name")
    .ilike("name", `%${q}%`)
    .order("name")
    .limit(6);
  if (error || !data) return [];
  return data
    .map((row) => ({
      id: row.id as string,
      name: typeof row.name === "string" ? row.name : "",
    }))
    .filter((row) => row.name);
}

export async function resolveAssistantTarget(
  ctx: AssistantToolContext,
  args: Record<string, unknown>,
  locale: AppLocale,
  purpose: "read" | "write",
): Promise<AssistantTarget> {
  const superadmin =
    ctx.zone === "superadmin" && ctx.callerIsSuperadmin === true;
  if (!superadmin) {
    return {
      kind: "one",
      restaurantId: ctx.restaurantId,
      restaurantName: await restaurantName(ctx.sb, ctx.restaurantId),
      sb: ctx.sb,
    };
  }

  if (wantsAll(args)) {
    if (purpose === "write") {
      return { kind: "ask", ask: assistantAsk(locale, "noWriteAll") };
    }
    const admin = createSupabaseAdminClient();
    if (!admin) return { kind: "ask", ask: assistantAsk(locale, "whichRestaurant") };
    return { kind: "all", sb: admin };
  }

  const name = namedHouse(args);
  const admin = createSupabaseAdminClient() ?? ctx.sb;
  if (name && name.toLowerCase() !== "alle" && name.toLowerCase() !== "all") {
    const matches = await searchRestaurants(admin, name);
    if (matches.length === 1) {
      return {
        kind: "one",
        restaurantId: matches[0].id,
        restaurantName: matches[0].name,
        sb: purpose === "write" ? ctx.sb : admin,
      };
    }
    if (matches.length > 1) {
      return {
        kind: "ask",
        ask: assistantAskWhich(
          locale,
          "whichRestaurant",
          matches.map((m) => m.name),
        ),
      };
    }
    return { kind: "ask", ask: assistantAsk(locale, "whichRestaurant") };
  }

  return {
    kind: "one",
    restaurantId: ctx.restaurantId,
    restaurantName: await restaurantName(ctx.sb, ctx.restaurantId),
    sb: purpose === "write" ? ctx.sb : admin,
  };
}
