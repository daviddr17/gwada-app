import { NextResponse } from "next/server";
import { appendLegacyAuthCookieCleanup } from "@/lib/cookies/bloated-request-cookies";

export const dynamic = "force-dynamic";

/** Setzt überflüssige OAuth-/Pending-Cookies zurück (Hilfe bei „cookie too large“). */
export async function GET() {
  const headers = new Headers();
  appendLegacyAuthCookieCleanup(headers);
  return new NextResponse(null, { status: 204, headers });
}
