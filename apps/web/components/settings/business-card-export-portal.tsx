"use client";

import { createPortal } from "react-dom";
import type { RefObject } from "react";
import { BusinessCardFaceView } from "@/components/settings/business-card-face-view";
import type { BusinessCardDesign } from "@/lib/restaurant/business-card-design";
import type { BusinessCardContent } from "@/lib/restaurant/business-card-layout";

type BusinessCardExportPortalProps = {
  design: BusinessCardDesign;
  content: BusinessCardContent;
  coverUrl: string | null;
  logoUrl: string | null;
  logoBadgeUrl: string | null;
  gwadaFaviconUrl: string | null;
  qrCodeUrl: string | null;
  restaurantId: string;
  frontRef: RefObject<HTMLDivElement | null>;
  backRef: RefObject<HTMLDivElement | null>;
};

/** Feste Export-Renderings auf document.body — außerhalb overflow:hidden. */
export function BusinessCardExportPortal({
  design,
  content,
  coverUrl,
  logoUrl,
  logoBadgeUrl,
  gwadaFaviconUrl,
  qrCodeUrl,
  restaurantId,
  frontRef,
  backRef,
}: BusinessCardExportPortalProps) {
  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      aria-hidden
      className="pointer-events-none fixed top-0 left-0 -z-10"
      style={{ transform: "translateX(-100vw)" }}
    >
      <BusinessCardFaceView
        ref={frontRef}
        design={design}
        content={content}
        side="front"
        coverUrl={coverUrl}
        logoUrl={logoUrl}
        logoBadgeUrl={logoBadgeUrl}
        gwadaFaviconUrl={gwadaFaviconUrl}
        qrCodeUrl={qrCodeUrl}
        restaurantId={restaurantId}
        useCanvasExportFonts
      />
      <BusinessCardFaceView
        ref={backRef}
        design={design}
        content={content}
        side="back"
        coverUrl={coverUrl}
        logoUrl={logoUrl}
        logoBadgeUrl={logoBadgeUrl}
        gwadaFaviconUrl={gwadaFaviconUrl}
        qrCodeUrl={qrCodeUrl}
        restaurantId={restaurantId}
        useCanvasExportFonts
      />
    </div>,
    document.body,
  );
}
