import { type NextRequest, NextResponse } from "next/server";
import { enforcePasswordGrantRateLimit } from "@/lib/api/auth-password-rate-limit";
import { stripBloatedCookiesFromCookieHeader } from "@/lib/cookies/bloated-request-cookies";
import { resolveSupabaseUpstreamUrl } from "@/lib/supabase/supabase-upstream-url";
import { sanitizeSvgBytes } from "@/lib/uploads/sanitize-svg";
import { SVG_DOCUMENT_GUARD_HEADERS } from "@/lib/uploads/upload-response-headers";

export const runtime = "nodejs";

async function proxyToSupabase(
  request: NextRequest,
  pathSegments: string[] | undefined,
  body?: ArrayBuffer,
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
    const payload = body ?? (await request.arrayBuffer());
    if (payload.byteLength > 0) init.body = payload;
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

  if (
    request.method === "GET" &&
    /storage\/v1\/object\/(?:public|sign)\/platform-branding\/[^/]+\.svg$/i.test(
      subPath,
    )
  ) {
    const raw = new Uint8Array(await upstreamRes.arrayBuffer());
    const clean = sanitizeSvgBytes(raw);
    if (!clean || !upstreamRes.ok) {
      return new NextResponse(upstreamRes.ok ? null : Buffer.from(raw), {
        status: upstreamRes.ok ? 404 : upstreamRes.status,
        headers: resHeaders,
      });
    }
    for (const [key, value] of Object.entries(SVG_DOCUMENT_GUARD_HEADERS)) {
      resHeaders.set(key, value);
    }
    resHeaders.delete("content-length");
    resHeaders.set("content-type", "image/svg+xml");
    return new NextResponse(Buffer.from(clean), {
      status: upstreamRes.status,
      statusText: upstreamRes.statusText,
      headers: resHeaders,
    });
  }

  return new NextResponse(upstreamRes.body, {
    status: upstreamRes.status,
    statusText: upstreamRes.statusText,
    headers: resHeaders,
  });
}

type RouteCtx = { params: Promise<{ path?: string[] }> };

async function handle(request: NextRequest, ctx: RouteCtx) {
  const { path } = await ctx.params;
  const segments = path ?? [];
  const isPasswordGrant =
    request.method === "POST" &&
    segments.join("/") === "auth/v1/token" &&
    request.nextUrl.searchParams.get("grant_type") === "password";

  if (!isPasswordGrant) {
    return proxyToSupabase(request, segments);
  }

  const body = await request.arrayBuffer();
  const limited = enforcePasswordGrantRateLimit(request, body);
  if (limited) return limited;
  return proxyToSupabase(request, segments, body);
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
export const OPTIONS = handle;
