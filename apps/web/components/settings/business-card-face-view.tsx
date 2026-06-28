"use client";

import { forwardRef } from "react";
import {
  businessCardPresetArtDirection,
  businessCardPresetStructureLine,
  BUSINESS_CARD_CONTENT_W,
  BUSINESS_CARD_MARGIN_X,
} from "@/lib/restaurant/business-card-art-direction";
import {
  BusinessCardElementContent,
  BusinessCardFaceAccentLayer,
  businessCardElementHasContent,
  shouldHideBusinessCardWebsiteElement,
} from "@/components/settings/business-card-element-content";
import {
  activeDecorationsForSide,
  activeElementsForSide,
  businessCardDecorationStackClassName,
  businessCardElementStackClassName,
  businessCardFormatAspect,
  businessCardVisualOpacity,
  type BusinessCardDesign,
  type BusinessCardSide,
} from "@/lib/restaurant/business-card-design";
import { BusinessCardDecorationVisual } from "@/components/settings/business-card-decoration-visual";
import type { BusinessCardContent } from "@/lib/restaurant/business-card-layout";
import { businessCardExportHeightPx } from "@/lib/restaurant/capture-business-card-pdf";
import { cn } from "@/lib/utils";

type BusinessCardFaceViewProps = {
  design: BusinessCardDesign;
  content: BusinessCardContent;
  side: BusinessCardSide;
  coverUrl: string | null;
  logoUrl: string | null;
  logoBadgeUrl?: string | null;
  gwadaFaviconUrl: string | null;
  qrCodeUrl?: string | null;
  restaurantId: string;
  className?: string;
  useCanvasExportFonts?: boolean;
};

export const BusinessCardFaceView = forwardRef<HTMLDivElement, BusinessCardFaceViewProps>(
  function BusinessCardFaceView(
    {
      design,
      content,
      side,
      coverUrl,
      logoUrl,
      logoBadgeUrl,
      gwadaFaviconUrl,
      qrCodeUrl,
      restaurantId,
      className,
      useCanvasExportFonts = false,
    },
    ref,
  ) {
    const aspect = businessCardFormatAspect(design.formatId);
    const heightPx = businessCardExportHeightPx(design.formatId);
    const widthPx = heightPx * aspect;
    const elements = activeElementsForSide(design, side);
    const decorations = activeDecorationsForSide(design, side);
    const coverElements = elements.filter((element) => element.type === "cover");
    const contentElements = elements.filter((element) => element.type !== "cover");
    const art = businessCardPresetArtDirection(design.presetId);
    const structureLine = businessCardPresetStructureLine(design.presetId, side);
    const atmosphere = art.faceAtmosphere(design.colors.accent, design.colors.background);

    return (
      <div
        ref={ref}
        className={cn("relative overflow-hidden", className)}
        style={{
          width: widthPx,
          height: heightPx,
          backgroundColor: design.colors.background,
          ...(atmosphere ? { background: atmosphere } : {}),
        }}
      >
        <BusinessCardFaceAccentLayer design={design} />

        {structureLine ? (
          <div
            aria-hidden
            className="pointer-events-none absolute z-[2]"
            style={{
              left: `${BUSINESS_CARD_MARGIN_X}%`,
              top: `${structureLine.topPct}%`,
              width: `${BUSINESS_CARD_CONTENT_W}%`,
              height: 1,
              opacity: structureLine.opacity,
              backgroundColor: design.colors.text,
            }}
          />
        ) : null}

        {coverElements.map((element) => {
          if (!businessCardElementHasContent(element.type, content, { coverUrl })) {
            return null;
          }

          const isCoverFull = element.rect.w >= 99 && element.rect.h >= 99;

          return (
            <div
              key={element.id}
              className={cn(
                "absolute overflow-hidden",
                businessCardElementStackClassName(element.type, design, {
                  isCoverFull,
                }),
              )}
              style={{
                left: `${element.rect.x}%`,
                top: `${element.rect.y}%`,
                width: `${element.rect.w}%`,
                height: `${element.rect.h}%`,
              }}
            >
              <BusinessCardElementContent
                type={element.type}
                content={content}
                colors={design.colors}
                rect={element.rect}
                canvasHeightPx={heightPx}
                canvasWidthPx={widthPx}
                typographyId={design.typographyId}
                presetId={design.presetId}
                accentStyle={design.accentStyle}
                coverUrl={coverUrl}
                logoUrl={logoUrl}
                gwadaFaviconUrl={gwadaFaviconUrl}
                qrCodeUrl={qrCodeUrl}
                imageOpacity={businessCardVisualOpacity(element.opacity)}
                className="size-full"
                useCanvasExportFonts={useCanvasExportFonts}
              />
            </div>
          );
        })}

        {decorations.map((decoration) => (
          <div
            key={decoration.id}
            className={cn(
              "absolute overflow-hidden pointer-events-none",
              businessCardDecorationStackClassName,
            )}
            style={{
              left: `${decoration.rect.x}%`,
              top: `${decoration.rect.y}%`,
              width: `${decoration.rect.w}%`,
              height: `${decoration.rect.h}%`,
            }}
          >
            <BusinessCardDecorationVisual
              decoration={decoration}
              restaurantId={restaurantId}
              className="size-full"
            />
          </div>
        ))}

        {contentElements.map((element) => {
          if (
            shouldHideBusinessCardWebsiteElement(
              element.type,
              design,
              side,
              content,
            )
          ) {
            return null;
          }

          if (!businessCardElementHasContent(element.type, content, { coverUrl })) {
            return null;
          }

          const isCoverFull =
            element.type === "cover" && element.rect.w >= 99 && element.rect.h >= 99;

          return (
            <div
              key={element.id}
              className={cn(
                "absolute",
                element.type === "logo" || element.type === "qrCode"
                  ? "overflow-visible"
                  : "overflow-hidden",
                businessCardElementStackClassName(element.type, design, {
                  isCoverFull,
                }),
              )}
              style={{
                left: `${element.rect.x}%`,
                top: `${element.rect.y}%`,
                width: `${element.rect.w}%`,
                height: `${element.rect.h}%`,
              }}
            >
              <BusinessCardElementContent
                type={element.type}
                content={content}
                colors={design.colors}
                rect={element.rect}
                canvasHeightPx={heightPx}
                canvasWidthPx={widthPx}
                typographyId={design.typographyId}
                presetId={design.presetId}
                accentStyle={design.accentStyle}
                coverUrl={coverUrl}
                logoUrl={logoUrl}
                precomposedLogoUrl={
                  element.type === "logo" ? logoBadgeUrl : undefined
                }
                gwadaFaviconUrl={gwadaFaviconUrl}
                qrCodeUrl={qrCodeUrl}
                imageOpacity={businessCardVisualOpacity(element.opacity)}
                className="size-full"
                useCanvasExportFonts={useCanvasExportFonts}
              />
            </div>
          );
        })}
      </div>
    );
  },
);

BusinessCardFaceView.displayName = "BusinessCardFaceView";
