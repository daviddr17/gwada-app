import {
  loadPlatformFaviconAsset,
  platformFaviconResponse,
} from "@/lib/platform/platform-favicon-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
  const asset = await loadPlatformFaviconAsset();
  if (!asset) {
    return new Response(null, { status: 404 });
  }
  return platformFaviconResponse(asset, request);
}
