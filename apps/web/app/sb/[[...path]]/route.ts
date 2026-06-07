import { type NextRequest, NextResponse } from "next/server";
import { stripBloatedCookiesFromCookieHeader } from "@/lib/cookies/bloated-request-cookies";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";

export const runtime = "nodejs";

async function proxyToSupabase(
  request: NextRequest,
  pathSegments: string[] | undefined,
): Promise<NextResponse> {
  const base = resolveSupabaseUpstreamUrl();
  const subPath = (pathSegments ?? []).join("/");
  const target = new URL(subPath, `${base}/`);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const strippedCookie = stripBloatedCookiesFromCookieHeader(
    headers.get("cookie"),
  );
  if (strippedCookie) headers.set("cookie", strippedCookie);
  else headers.delete("cookie");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(target, init);
  } catch (error) {
    console.error("[sb proxy] upstream fetch failed", target.toString(), error);
    return NextResponse.json(
      { error: "supabase_upstream_unreachable" },
      { status: 502 },
    );
  }

  const resHeaders = new Headers(upstreamRes.headers);
  resHeaders.delete("transfer-encoding");

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: resHeaders,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function handle(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  return proxyToSupabase(request, path);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
