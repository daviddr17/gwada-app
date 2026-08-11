import { assertBillingFeature } from "@/lib/billing/assert-billing-feature";
import { assertPlatformWhatsappEnabled } from "@/lib/integrations/platform-messaging-guard";
import { isMetaReviewDemoRestaurantSlug } from "@/lib/restaurants/meta-review-demo";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";

export type WahaRouteContext = {
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
  userId: string;
  restaurantId: string;
};

export async function authorizeWahaRestaurantRoute(
  restaurantIdRaw: string | null,
  options?: { requireBilling?: boolean },
): Promise<
  | { ok: true; ctx: WahaRouteContext }
  | { ok: false; status: number; error: string }
> {
  const restaurantId = restaurantIdRaw?.trim() ?? "";
  if (!isUuidRestaurantId(restaurantId)) {
    return { ok: false, status: 400, error: "invalid_restaurant_id" };
  }

  const admin = createSupabaseAdminClient();
  if (admin) {
    const { data: rest } = await admin
      .from("restaurants")
      .select("slug")
      .eq("id", restaurantId)
      .maybeSingle();
    if (
      isMetaReviewDemoRestaurantSlug(
        (rest as { slug?: string } | null)?.slug,
      )
    ) {
      return { ok: false, status: 403, error: "whatsapp_disabled" };
    }
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { ok: false, status: 401, error: "unauthorized" };
  }

  const { data: allowed, error: rpcError } = await supabase.rpc(
    "auth_has_restaurant_permission",
    {
      p_restaurant_id: restaurantId,
      p_permission: "integrations.whatsapp",
    },
  );

  if (rpcError) {
    console.warn("auth_has_restaurant_permission", rpcError.message);
    return { ok: false, status: 403, error: "forbidden" };
  }

  if (!allowed) {
    return { ok: false, status: 403, error: "forbidden" };
  }

  const platform = await assertPlatformWhatsappEnabled(supabase);
  if (!platform.ok) {
    return { ok: false, status: 403, error: platform.error };
  }

  const requireBilling = options?.requireBilling !== false;
  if (requireBilling) {
    const billing = await assertBillingFeature(
      restaurantId,
      "integrations.whatsapp",
    );
    if (!billing.ok) {
      return { ok: false, status: 403, error: "plan_required" };
    }
  }

  return {
    ok: true,
    ctx: { supabase, userId: user.id, restaurantId },
  };
}
