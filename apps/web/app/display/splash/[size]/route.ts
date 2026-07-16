import { parseAppleStartupImageSize } from "@/lib/pwa/apple-startup-images";
import { renderPwaSplashServer } from "@/lib/pwa/render-pwa-splash-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const parsed = parseAppleStartupImageSize(rawSize);
  if (!parsed) {
    return new Response(null, { status: 404 });
  }

  const body = await renderPwaSplashServer(parsed.width, parsed.height, "G");

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
