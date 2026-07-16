import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import { retryPosZAutopilot } from "@/lib/accounting/accounting-pos-z-import-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    restaurantId?: string;
    sessionId?: string;
  };
  const restaurantId = restaurantIdFromRequest(req, body);
  const auth = await assertAccountingApi(restaurantId, "create");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sessionId = body.sessionId?.trim() ?? "";
  if (!sessionId) {
    return NextResponse.json({ error: "session_id_required" }, { status: 400 });
  }

  try {
    const result = await retryPosZAutopilot({
      restaurantId: auth.restaurantId,
      sessionId,
      actorUserId: auth.userId,
    });
    if (result.error && !result.importRow) {
      return NextResponse.json(
        { error: result.error, result },
        { status: 400 },
      );
    }
    return NextResponse.json({ result });
  } catch {
    return NextResponse.json({ error: "retry_failed" }, { status: 500 });
  }
}
