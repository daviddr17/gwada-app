import { NextResponse } from "next/server";
import {
  assertAccountingApi,
  restaurantIdFromRequest,
} from "@/lib/accounting/assert-accounting-api";
import {
  getPosZAutopilotImport,
  listPosZAutopilotImports,
} from "@/lib/accounting/accounting-pos-z-import-server";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const restaurantId = restaurantIdFromRequest(req);
  const auth = await assertAccountingApi(restaurantId, "read");
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const sessionId = url.searchParams.get("sessionId")?.trim();
  const sessionIdsParam = url.searchParams.get("sessionIds")?.trim();

  try {
    if (sessionId) {
      const row = await getPosZAutopilotImport(auth.restaurantId, sessionId);
      return NextResponse.json({ import: row });
    }

    const sessionIds = sessionIdsParam
      ? sessionIdsParam
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean)
      : [];
    const imports = await listPosZAutopilotImports(
      auth.restaurantId,
      sessionIds,
    );
    return NextResponse.json({ imports });
  } catch {
    return NextResponse.json({ error: "load_failed" }, { status: 500 });
  }
}
