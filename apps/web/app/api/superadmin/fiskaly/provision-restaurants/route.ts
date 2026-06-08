import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  countFiskalyProvisionStats,
  provisionAllRestaurantsFiskaly,
} from "@/lib/pos/fiskaly-provision";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const stats = await countFiskalyProvisionStats();
  return Response.json(stats);
}

export async function POST() {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return Response.json({ error: auth.error }, { status: auth.status });
  }

  const result = await provisionAllRestaurantsFiskaly();
  return Response.json(result);
}
