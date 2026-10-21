import { NextResponse } from "next/server";
import { resolveRestaurantBySlug } from "@/lib/ordering/create-guest-order-server";
import { loadOnlineOrderingSettings } from "@/lib/ordering/online-ordering-settings-server";
import {
  earliestReadyAt,
  formatEarliestLabelDe,
  leadMinutesForFulfillment,
} from "@/lib/ordering/ordering-lead-time";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { PosFulfillmentType } from "@gwada/pos-domain";

export const dynamic = "force-dynamic";

/**
 * Legacy path — returns earliest ready time (Mindestvorlauf), not capacity slots.
 * Guest UX uses checkout timingMode; this remains for older clients.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  const { slug } = await context.params;
  const fulfillment = (new URL(request.url).searchParams.get("fulfillment") ??
    "pickup") as PosFulfillmentType;

  const restaurant = await resolveRestaurantBySlug(slug);
  if (!restaurant.ok) {
    return NextResponse.json(
      { error: restaurant.error },
      { status: restaurant.status },
    );
  }

  const admin = createSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json(
      { error: "server_misconfigured" },
      { status: 503 },
    );
  }

  const settings = await loadOnlineOrderingSettings(
    admin,
    restaurant.restaurantId,
  );
  const earliest = earliestReadyAt(settings, fulfillment);
  const leadMinutes = leadMinutesForFulfillment(settings, fulfillment);

  return NextResponse.json({
    earliestAt: earliest.toISOString(),
    leadMinutes,
    label: formatEarliestLabelDe(earliest),
    /** @deprecated empty — capacity timeslots removed from guest model */
    slots: [],
    timeslotsEnabled: false,
  });
}
