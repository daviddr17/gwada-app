import { NextResponse } from "next/server";
import { appendAuthEntryCookieCleanup } from "@/lib/cookies/bloated-request-cookies";

export const dynamic = "force-dynamic";

/** Setzt überflüssige OAuth-/Pending-Cookies zurück (Hilfe bei „cookie too large“). */
export async function GET() {
  const headers = new Headers();
  appendAuthEntryCookieCleanup(headers);
  return new NextResponse(null, { status: 204, headers });
}
