import { isDisplayPwaIconSize } from "@/lib/display/display-pwa-config";
import { renderDisplayPwaIcon } from "@/lib/display/display-pwa-icon-server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: Request,
  context: { params: Promise<{ size: string }> },
) {
  const { size: rawSize } = await context.params;
  const size = Number.parseInt(rawSize, 10);
  if (!isDisplayPwaIconSize(size)) {
    return new Response(null, { status: 404 });
  }

  const body = await renderDisplayPwaIcon(size);

  return new Response(new Uint8Array(body), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800",
    },
  });
}
