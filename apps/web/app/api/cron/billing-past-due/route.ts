import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { runDailyBillingHealthCheck } from "@/lib/billing/daily-billing-health";
import { withCronHeartbeat } from "@/lib/ops/record-cron-heartbeat";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const stats = await withCronHeartbeat("billing-past-due", () =>
    runDailyBillingHealthCheck(),
  );
  return Response.json(stats);
}

export async function POST(req: Request) {
  return GET(req);
}
