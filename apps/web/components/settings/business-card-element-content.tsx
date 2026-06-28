"use client";

import { Fragment } from "react";
import { Clock, Globe, MapPin, Phone } from "lucide-react";
import {
  businessCardEditorFontSizeCssPx,
  businessCardAddressVisualLineCount,
  businessCardAddressBodyFontSizeCssPx,
  businessCardContactLineFontSizeCssPx,
  businessCardEditorNameFontSizeCssPx,
  businessCardNameLineCount,
  businessCardOpeningHoursBodyFontSizeCssPx,
  BUSINESS_CARD_ADDRESS_LINE_HEIGHT,
  BUSINESS_CARD_NAME_LINE_HEIGHT,
  BUSINESS_CARD_OPENING_HOURS_LINE_HEIGHT,
  BUSINESS_CARD_LOGO_IMAGE_INSET_PCT,
  BUSINESS_CARD_LOGO_INNER_SCALE,
  businessCardLogoDisplaySidePx,
  businessCardCoverOverlayBackground,
  businessCardReadableAccent,
  businessCardSecondaryTextColor,
  businessCardUsesCoverOverlay,
  businessCardUsesHoursPanel,
  type BusinessCardAccentStyle,
  type BusinessCardColors,
  type BusinessCardDesign,
  type BusinessCardElementType,
  type BusinessCardRect,
  type BusinessCardSide,
  activeElementsForSide,
} from "@/lib/restaurant/business-card-design";
import {
  businessCardFontFamilyForCanvasExport,
  businessCardTypography,
  type BusinessCardTypographyId,
} from "@/lib/restaurant/business-card-typography";
import {
  businessCardPresetArtDirection,
} from "@/lib/restaurant/business-card-art-direction";
import type { BusinessCardPresetId } from "@/lib/restaurant/business-card-design";
import type { BusinessCardContent } from "@/lib/restaurant/business-card-layout";
import { getAccentForeground, normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { cn } from "@/lib/utils";

function restaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  return name.trim().slice(0, 2).toLocaleUpperCase("de-DE") || "?";
}

function scaledFontSize(
  rect: BusinessCardRect,
  factor: number,
  canvasHeightPx: number,
): string {
  return `${businessCardEditorFontSizeCssPx(rect, factor, canvasHeightPx)}px`;
}

const textInsetClassName = "px-[0.32em] py-[0.12em]";

function cardContentPadding(canvasHeightPx: number): {
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
} {
  const pad = Math.max(5, Math.round(canvasHeightPx * 0.026));
  return {
    paddingLeft: pad,
    paddingRight: pad,
    paddingTop: Math.max(2, Math.round(pad * 0.35)),
  };
}

const textBoxClassName = cn(
  "flex size-full min-h-0 min-w-0 flex-col justify-start overflow-hidden",
  textInsetClassName,
);

function BusinessCardFieldIcon({
  icon: Icon,
  accentColor,
  className,
}: {
  icon: typeof MapPin;
  accentColor: string;
  className?: string;
}) {
  return (
    <Icon
      className={cn("size-[0.95em] shrink-0", className)}
      style={{ color: accentColor }}
      aria-hidden
      strokeWidth={2}
    />
  );
}

const businessCardFieldRowClassName =
  "flex min-h-0 min-w-0 items-center gap-[0.45em]";

const addressBoxClassName =
  "flex size-full min-h-0 min-w-0 flex-col justify-start overflow-hidden";

const contactBoxClassName =
  "flex size-full min-h-0 min-w-0 flex-col justify-center overflow-hidden";

type BusinessCardElementContentProps = {
  type: BusinessCardElementType;
  content: BusinessCardContent;
  colors: BusinessCardColors;
  rect: BusinessCardRect;
  canvasHeightPx: number;
  canvasWidthPx: number;
  typographyId: BusinessCardTypographyId;
  presetId?: BusinessCardPresetId;
  accentStyle: BusinessCardAccentStyle;
  coverUrl: string | null;
  logoUrl: string | null;
  gwadaFaviconUrl?: string | null;
  precomposedLogoUrl?: string | null;
  qrCodeUrl?: string | null;
  className?: string;
  /** 0–1 für Cover/Logo */
  imageOpacity?: number;
  /** PDF/html2canvas: keine Cross-Origin-Webfonts (sonst tainted canvas). */
  useCanvasExportFonts?: boolean;
};

function resolveTypographyFontFamily(
  typographyId: BusinessCardTypographyId,
  kind: "heading" | "body",
  useCanvasExportFonts: boolean,
): string {
  if (useCanvasExportFonts) {
    return businessCardFontFamilyForCanvasExport(typographyId, kind);
  }
  const typo = businessCardTypography(typographyId);
  return kind === "heading" ? typo.headingFamily : typo.bodyFamily;
}

export function BusinessCardElementContent({
  type,
  content,
  colors,
  rect,
  canvasHeightPx,
  canvasWidthPx,
  typographyId,
  presetId,
  accentStyle,
  coverUrl,
  logoUrl,
  gwadaFaviconUrl,
  precomposedLogoUrl,
  qrCodeUrl,
  className,
  imageOpacity = 1,
  useCanvasExportFonts = false,
}: BusinessCardElementContentProps) {
  const accent = normalizeHex(colors.accent) ?? DEFAULT_ACCENT_HEX;
  const onAccent = getAccentForeground(accent);
  const readableAccent = businessCardReadableAccent(colors);
  const secondaryText = businessCardSecondaryTextColor(colors);
  const coverOverlay = businessCardUsesCoverOverlay(accentStyle, colors);
  const hoursPanel = businessCardUsesHoursPanel(colors);
  const contentPad = cardContentPadding(canvasHeightPx);
  const typo = businessCardTypography(typographyId);
  const art = businessCardPresetArtDirection(presetId);
  const headingFamily = resolveTypographyFontFamily(
    typographyId,
    "heading",
    useCanvasExportFonts,
  );
  const bodyFamily = resolveTypographyFontFamily(
    typographyId,
    "body",
    useCanvasExportFonts,
  );

  switch (type) {
    case "name": {
      const nameLines = businessCardNameLineCount(content.name);
      const verticalPadPx = contentPad.paddingTop + Math.max(3, Math.round(canvasHeightPx * 0.012));
      const nameFontSize = businessCardEditorNameFontSizeCssPx(rect, canvasHeightPx, {
        lineCount: nameLines,
        nameScale: typo.nameScale,
        hasAccentLine: accentStyle === "line",
        verticalPadPx,
      });

      return (
        <div
          className={cn(textBoxClassName, className)}
          style={{
            paddingLeft: contentPad.paddingLeft,
            paddingRight: contentPad.paddingRight,
            paddingTop: contentPad.paddingTop,
            paddingBottom: Math.max(2, Math.round(canvasHeightPx * 0.01)),
          }}
        >
          <p
            className="min-h-0 min-w-0 break-words"
            style={{
              color: colors.text,
              fontFamily: headingFamily,
              fontWeight: typo.nameWeight,
              letterSpacing: typo.nameTracking,
              fontSize: `${nameFontSize}px`,
              lineHeight: BUSINESS_CARD_NAME_LINE_HEIGHT,
            }}
          >
            {content.name}
          </p>
          {accentStyle === "line" ? (
            <div
              className="mt-[0.36em] h-px w-[3.25em] shrink-0 opacity-30"
              style={{ backgroundColor: readableAccent }}
            />
          ) : null}
        </div>
      );
    }
    case "address": {
      const lineCount = businessCardAddressVisualLineCount(content.addressLines);
      const paddingBottom = Math.max(2, Math.round(canvasHeightPx * 0.008));
      const verticalPadPx =
        Math.max(2, Math.round(contentPad.paddingTop * 0.35)) + paddingBottom + 2;
      const addressFontSize = businessCardAddressBodyFontSizeCssPx(
        rect,
        lineCount,
        canvasHeightPx,
        verticalPadPx,
      );

      return (
        <div
          className={cn(addressBoxClassName, className)}
          style={{
            color: secondaryText,
            fontFamily: bodyFamily,
            fontSize: `${addressFontSize}px`,
            lineHeight: BUSINESS_CARD_ADDRESS_LINE_HEIGHT,
            letterSpacing: "0.01em",
            paddingLeft: contentPad.paddingLeft,
            paddingRight: contentPad.paddingRight,
            paddingTop: Math.max(2, Math.round(contentPad.paddingTop * 0.35)),
            paddingBottom,
          }}
        >
          <div className={cn(businessCardFieldRowClassName, "items-start")}>
            <BusinessCardFieldIcon
              icon={MapPin}
              accentColor={readableAccent}
              className="mt-[0.12em]"
            />
            <p className="min-h-0 min-w-0 flex-1 break-words">
              {content.addressLines.map((line, index) => (
                <Fragment key={line}>
                  {index > 0 ? <br /> : null}
                  {line}
                </Fragment>
              ))}
            </p>
          </div>
        </div>
      );
    }
    case "phone": {
      const combined =
        art.combineContactOnPhone &&
        content.phone &&
        content.websiteLabel;
      const line = combined
        ? `${content.phone} · ${content.websiteLabel}`
        : content.phone;
      if (!line) return null;

      return (
        <div
          className={cn(contactBoxClassName, className)}
          style={{
            color: secondaryText,
            fontFamily: bodyFamily,
            fontSize: `${businessCardContactLineFontSizeCssPx(rect, canvasHeightPx, { combinedLine: Boolean(combined) })}px`,
            letterSpacing: "0.025em",
            paddingLeft: contentPad.paddingLeft,
            paddingRight: contentPad.paddingRight,
            paddingTop: Math.max(2, Math.round(contentPad.paddingTop * 0.25)),
            paddingBottom: Math.max(2, Math.round(canvasHeightPx * 0.008)),
          }}
        >
          <div className={businessCardFieldRowClassName}>
            <BusinessCardFieldIcon icon={Phone} accentColor={readableAccent} />
            <p className="min-w-0 flex-1 truncate tabular-nums">{line}</p>
          </div>
        </div>
      );
    }
    case "website":
      return content.websiteLabel ? (
        <div
          className={cn(textBoxClassName, "justify-center", className)}
          style={{
            color: secondaryText,
            fontFamily: bodyFamily,
            fontSize: scaledFontSize(rect, 0.28, canvasHeightPx),
            letterSpacing: "0.01em",
            ...contentPad,
          }}
        >
          <div className={businessCardFieldRowClassName}>
            <BusinessCardFieldIcon icon={Globe} accentColor={readableAccent} />
            <p className="min-w-0 flex-1 truncate">{content.websiteLabel}</p>
          </div>
        </div>
      ) : null;
    case "cover":
      return coverUrl ? (
        <div className={cn("relative size-full overflow-hidden", className)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="size-full object-cover"
            style={{ opacity: imageOpacity }}
            draggable={false}
          />
          {coverOverlay ? (
            <div
              className="pointer-events-none absolute inset-0"
              style={{
                background: businessCardCoverOverlayBackground(colors, accentStyle),
              }}
            />
          ) : null}
        </div>
      ) : null;
    case "logo": {
      const logoRadius =
        art.logoStyle === "squircle" ? "rounded-[22%]" : "rounded-full";
      const logoShadow = "shadow-[0_3px_18px_rgba(0,0,0,0.09)]";
      const logoSidePx = businessCardLogoDisplaySidePx(
        rect,
        canvasWidthPx,
        canvasHeightPx,
      );

      if (precomposedLogoUrl) {
        return (
          <div className={cn("flex size-full items-center justify-center", className)}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={precomposedLogoUrl}
              alt=""
              draggable={false}
              className={cn(
                "block max-w-none",
                !useCanvasExportFonts && logoRadius,
                !useCanvasExportFonts && logoShadow,
              )}
              style={
                useCanvasExportFonts
                  ? {
                      width: logoSidePx,
                      height: logoSidePx,
                      objectFit: "contain",
                      opacity: imageOpacity,
                    }
                  : {
                      width: `${BUSINESS_CARD_LOGO_INNER_SCALE * 100}%`,
                      aspectRatio: "1 / 1",
                      height: "auto",
                      opacity: imageOpacity,
                    }
              }
            />
          </div>
        );
      }
      return (
        <div
          className={cn("flex size-full items-center justify-center", className)}
          style={{ opacity: imageOpacity }}
        >
          <div
            className={cn(
              "box-border flex shrink-0 items-center justify-center overflow-hidden bg-white/96",
              logoRadius,
              logoShadow,
            )}
            style={{
              width: logoSidePx,
              height: logoSidePx,
              padding: `${BUSINESS_CARD_LOGO_IMAGE_INSET_PCT}%`,
            }}
          >
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                className="max-h-full max-w-full object-contain"
                draggable={false}
              />
            ) : (
              <span
                className="flex size-full items-center justify-center font-bold"
                style={{
                  backgroundColor: accent,
                  color: onAccent,
                  fontFamily: headingFamily,
                  fontSize: scaledFontSize(rect, 0.35, canvasHeightPx),
                }}
              >
                {restaurantInitials(content.name)}
              </span>
            )}
          </div>
        </div>
      );
    }
    case "openingHours": {
      const rowCount = content.hourRows.length;
      const paddingBottom = Math.max(2, Math.round(canvasHeightPx * 0.01));
      let verticalPadPx = contentPad.paddingTop + paddingBottom + 4;
      if (hoursPanel) {
        verticalPadPx += Math.round(canvasHeightPx * 0.014);
      }

      const bodyFontSize = businessCardOpeningHoursBodyFontSizeCssPx(
        rect,
        rowCount,
        canvasHeightPx,
        { verticalPadPx },
      );
      const titleFontSize = bodyFontSize * 1.12;

      return content.hourRows.length > 0 ? (
        <div
          className={cn(
            textBoxClassName,
            hoursPanel && "rounded-lg px-2 py-1.5 backdrop-blur-[2px]",
            className,
          )}
          style={{
            fontFamily: bodyFamily,
            fontSize: `${bodyFontSize}px`,
            ...(hoursPanel
              ? { backgroundColor: `${colors.background}cc` }
              : contentPad),
          }}
        >
          <div
            className={cn(
              businessCardFieldRowClassName,
              "mb-[0.65em] shrink-0 leading-none",
            )}
            style={{ fontSize: `${titleFontSize}px` }}
          >
            <BusinessCardFieldIcon icon={Clock} accentColor={readableAccent} />
            <p
              className={cn(
                "min-w-0 flex-1 font-medium leading-none",
                art.hoursTitleUppercase && "uppercase tracking-[0.14em]",
              )}
              style={{
                color: colors.text,
                fontFamily: headingFamily,
                fontWeight: art.hoursTitleUppercase ? 500 : typo.nameWeight,
                letterSpacing: art.hoursTitleUppercase ? undefined : typo.nameTracking,
              }}
            >
              Öffnungszeiten
            </p>
          </div>
          <div
            className="min-h-0 flex-1 overflow-hidden"
            style={{
              display: "grid",
              gridTemplateColumns: "max-content minmax(0, 1fr)",
              columnGap: "0.75em",
              rowGap: "0.18em",
              lineHeight: BUSINESS_CARD_OPENING_HOURS_LINE_HEIGHT,
            }}
          >
            {content.hourRows.map((row) => (
              <Fragment key={`${row.label}-${row.value}`}>
                <span
                  className={cn(
                    "whitespace-nowrap font-medium leading-none",
                    art.hoursTitleUppercase && "uppercase tracking-[0.08em]",
                  )}
                  style={{ color: secondaryText }}
                >
                  {row.label}
                </span>
                <span
                  className="min-w-0 text-right tabular-nums leading-none"
                  style={{ color: colors.text }}
                >
                  {row.value}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      ) : null;
    }
    case "gwadaFooter":
      return (
        <div
          className={cn(
            textBoxClassName,
            "justify-end pb-px pt-1 text-center tracking-[0.08em]",
            className,
          )}
          style={{
            color: secondaryText,
            fontFamily: bodyFamily,
            fontSize: scaledFontSize(rect, 0.38, canvasHeightPx),
            opacity: 0.72,
            ...contentPad,
          }}
        >
          Erstellt mit Gwada
        </div>
      );
    case "gwadaFavicon":
      return gwadaFaviconUrl ? (
        <div className={cn("flex size-full items-center justify-center", className)}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={gwadaFaviconUrl}
            alt=""
            draggable={false}
            className="max-h-full max-w-full object-contain opacity-80"
          />
        </div>
      ) : null;
    case "qrCode":
      return qrCodeUrl ? (
        <div
          className={cn(
            "flex size-full items-center justify-center bg-white/92 p-[4%] shadow-[0_1px_10px_rgba(0,0,0,0.05)] ring-1 ring-black/[0.035]",
            art.qrMinimal ? "rounded-lg" : "rounded-xl",
            className,
          )}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={qrCodeUrl}
            alt=""
            draggable={false}
            className="size-full object-contain"
          />
        </div>
      ) : null;
    default:
      return null;
  }
}

/** Website ausblenden, wenn Telefonzeile „Tel · Web“ übernimmt. */
export function shouldHideBusinessCardWebsiteElement(
  type: BusinessCardElementType,
  design: BusinessCardDesign,
  side: BusinessCardSide,
  content: BusinessCardContent,
): boolean {
  if (type !== "website") return false;
  const art = businessCardPresetArtDirection(design.presetId);
  if (!art.combineContactOnPhone) return false;

  const phoneOnSide = activeElementsForSide(design, side).find(
    (el) => el.type === "phone" && el.enabled,
  );
  return Boolean(phoneOnSide && content.phone && content.websiteLabel);
}

export function businessCardElementHasContent(
  type: BusinessCardElementType,
  content: BusinessCardContent,
  opts: { coverUrl: string | null },
): boolean {
  switch (type) {
    case "name":
      return Boolean(content.name.trim());
    case "address":
      return content.addressLines.length > 0;
    case "phone":
      return Boolean(content.phone);
    case "website":
      return Boolean(content.websiteLabel);
    case "cover":
      return Boolean(opts.coverUrl);
    case "logo":
      return true;
    case "openingHours":
      return content.hourRows.length > 0;
    case "gwadaFooter":
    case "gwadaFavicon":
      return true;
    case "qrCode":
      return Boolean(content.websiteHref);
    default:
      return false;
  }
}

/** Karten-Hintergrund-Effekte (Akzent-Streifen). */
export function BusinessCardFaceAccentLayer({
  design,
}: {
  design: BusinessCardDesign;
}) {
  const accent = normalizeHex(design.colors.accent) ?? DEFAULT_ACCENT_HEX;

  if (design.accentStyle === "sideBar") {
    return (
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 z-0 flex items-stretch"
        style={{ width: "10%" }}
      >
        <div
          className="my-[12%] ml-[22%] w-px opacity-25"
          style={{ backgroundColor: accent }}
        />
      </div>
    );
  }

  return null;
}
