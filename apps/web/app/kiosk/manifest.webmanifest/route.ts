import { NextResponse } from "next/server";
import {
  KIOSK_PWA_SCOPE,
  kioskPwaStartUrl,
} from "@/lib/ordering/kiosk-pwa-config";

export const dynamic = "force-dynamic";

/** Standalone PWA for iPad home-screen / Android kiosk browser start URL. */
export async function GET(request: Request) {
  const slug =
    new URL(request.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const startUrl = slug ? kioskPwaStartUrl(slug) : "/kiosk/";

  const manifest = {
    name: "Gwada Kiosk",
    short_name: "Kiosk",
    description:
      "Gast-Self-Order (Tisch-iPad oder Android-Counter). Nicht die Website.",
    start_url: startUrl,
    scope: KIOSK_PWA_SCOPE,
    display: "standalone",
    orientation: "any",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      {
        src: "/display/icon/192",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/display/icon/512",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=300",
    },
  });
}
