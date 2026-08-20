import { assertCronAuthorized } from "@/lib/api/cron-auth";
import { cancelStripeSubscriptionsPastDueGraceExpired } from "@/lib/billing/cancel-past-due-grace";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const cronAuth = assertCronAuthorized(req);
  if (cronAuth) return cronAuth;

  const stats = await cancelStripeSubscriptionsPastDueGraceExpired();
  return Response.json(stats);
}

export async function POST(req: Request) {
  return GET(req);
}
