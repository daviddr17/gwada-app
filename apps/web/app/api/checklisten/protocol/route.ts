import { NextResponse } from "next/server";
import { assertChecklistProtocolApi } from "@/lib/checklisten/assert-checklist-protocol-api";
import { listChecklistProtocolPage } from "@/lib/checklisten/checklist-protocol-server";
import {
  CHECKLIST_PROTOCOL_DEFAULT_KIND,
  CHECKLIST_PROTOCOL_DEFAULT_PERIOD,
  type ChecklistProtocolDeviationFilter,
  type ChecklistProtocolKindFilter,
  type ChecklistProtocolPeriodFilter,
  type ChecklistProtocolSortKey,
} from "@/lib/checklisten/checklist-protocol-entries";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { fetchRestaurantIanaTimezone } from "@/lib/supabase/restaurant-timezone-db";

function parseFilter<T extends string>(
  raw: string | null,
  allowed: readonly T[],
  fallback: T,
): T {
  if (raw && (allowed as readonly string[]).includes(raw)) {
    return raw as T;
  }
  return fallback;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const restaurantId = url.searchParams.get("restaurant_id")?.trim() ?? "";
  if (!restaurantId) {
    return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  }

  const access = await assertChecklistProtocolApi(restaurantId);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const sb = await createSupabaseServerClient();
    const timeZone =
      url.searchParams.get("time_zone")?.trim() ||
      (await fetchRestaurantIanaTimezone(restaurantId));

    const result = await listChecklistProtocolPage(sb, restaurantId, {
      page: Number.parseInt(url.searchParams.get("page") ?? "1", 10),
      pageSize: Number.parseInt(url.searchParams.get("page_size") ?? "50", 10),
      search: url.searchParams.get("search") ?? "",
      kind: parseFilter<ChecklistProtocolKindFilter>(
        url.searchParams.get("kind"),
        ["capture", "change"],
        CHECKLIST_PROTOCOL_DEFAULT_KIND,
      ),
      period: parseFilter<ChecklistProtocolPeriodFilter>(
        url.searchParams.get("period"),
        ["all", "today", "7d", "30d"],
        CHECKLIST_PROTOCOL_DEFAULT_PERIOD,
      ),
      areaId: url.searchParams.get("area_id") ?? "all",
      deviceId: url.searchParams.get("device_id") ?? "all",
      deviation: parseFilter<ChecklistProtocolDeviationFilter>(
        url.searchParams.get("deviation"),
        ["all", "deviation", "ok"],
        "all",
      ),
      sortKey: parseFilter<ChecklistProtocolSortKey>(
        url.searchParams.get("sort"),
        ["newest", "oldest"],
        "newest",
      ),
      timeZone,
    });

    return NextResponse.json(result);
  } catch (err) {
    console.warn("checklist protocol list", err);
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
