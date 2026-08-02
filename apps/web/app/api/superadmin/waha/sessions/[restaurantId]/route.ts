import { NextResponse } from "next/server";
import { z } from "zod";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import {
  loadWahaSessionAdminDetail,
  runWahaSessionAdminAction,
  WAHA_SESSION_ADMIN_ACTIONS,
} from "@/lib/superadmin/waha-session-admin-actions";

type RouteContext = { params: Promise<{ restaurantId: string }> };

const actionBodySchema = z.object({
  action: z.enum(WAHA_SESSION_ADMIN_ACTIONS),
});

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { restaurantId } = await context.params;
  const result = await loadWahaSessionAdminDetail(restaurantId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.detail);
}

export async function POST(request: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { restaurantId } = await context.params;
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Ungültiger JSON-Body." }, { status: 400 });
  }

  const parsed = actionBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "Ungültige Aktion." }, { status: 400 });
  }

  const result = await runWahaSessionAdminAction(restaurantId, parsed.data.action);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({
    ok: true,
    message: result.message,
    detail: result.detail,
  });
}
