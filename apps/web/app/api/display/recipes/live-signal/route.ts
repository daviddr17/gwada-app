import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { assertDisplayModuleAccess } from "@/lib/display/display-auth-server";
import { loadDisplayRecipesLiveRevision } from "@/lib/display/display-recipes-live-server";

export async function GET() {
  const cookieStore = await cookies();
  const access = await assertDisplayModuleAccess(cookieStore, "recipes");
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const signal = await loadDisplayRecipesLiveRevision(access.restaurantId);
  return NextResponse.json(signal);
}
