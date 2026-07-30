import { NextResponse } from "next/server";
import { assertSuperadminApi } from "@/lib/superadmin/assert-superadmin-api";
import { loadSuperadminUserProfile } from "@/lib/superadmin/load-superadmin-entity-profiles";

type RouteContext = { params: Promise<{ profileId: string }> };

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: RouteContext) {
  const auth = await assertSuperadminApi();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { profileId } = await context.params;
  const result = await loadSuperadminUserProfile(profileId);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.detail);
}
