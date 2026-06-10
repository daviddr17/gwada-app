import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  countFiskalyProvisionStats,
  listFiskalyProvisionLocations,
  provisionRestaurantsFiskaly,
} from "@/lib/pos/fiskaly-provision";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const checkRemote = url.searchParams.get("checkRemote") === "1";

  const [stats, locations] = await Promise.all([
    countFiskalyProvisionStats(),
    listFiskalyProvisionLocations({ checkRemote }),
  ]);

  return Response.json({ ...stats, locations });
}

export async function POST(request: Request) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  let restaurantIds: string[] | undefined;
  try {
    const body = (await request.json().catch(() => ({}))) as {
      restaurantIds?: string[];
    };
    if (Array.isArray(body.restaurantIds) && body.restaurantIds.length > 0) {
      restaurantIds = body.restaurantIds;
    }
  } catch {
    // empty body → all restaurants
  }

  const result = await provisionRestaurantsFiskaly(restaurantIds);
  return Response.json(result);
}
