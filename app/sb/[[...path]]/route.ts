import { type NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

/** Kong auf dem VPS — bewusst ohne resolve-url (Coolify hat oft nur Anon-Key zur Runtime). */
const DEFAULT_UPSTREAM = "http://95.111.229.250:8001";

function upstreamBase(): string {
  const raw = process.env.SUPABASE_UPSTREAM_URL?.trim();
  if (raw) return raw.replace(/\/+$/, "");
  const pub = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (pub && !pub.includes("/sb")) return pub.replace(/\/+$/, "");
  return DEFAULT_UPSTREAM;
}

async function proxyToSupabase(
  request: NextRequest,
  pathSegments: string[] | undefined,
): Promise<NextResponse> {
  const base = upstreamBase();
  const subPath = (pathSegments ?? []).join("/");
  const target = new URL(subPath, `${base}/`);
  target.search = request.nextUrl.search;

  const headers = new Headers(request.headers);
  headers.delete("host");
  headers.delete("connection");

  const init: RequestInit = {
    method: request.method,
    headers,
    redirect: "manual",
  };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const body = await request.arrayBuffer();
    if (body.byteLength > 0) init.body = body;
  }

  const upstreamRes = await fetch(target, init);
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
