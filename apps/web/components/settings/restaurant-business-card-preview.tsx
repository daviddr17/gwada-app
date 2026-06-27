"use client";

import { useState } from "react";
import {
  BUSINESS_CARD_ASPECT,
  type BusinessCardContent,
  type BusinessCardOptions,
} from "@/lib/restaurant/business-card-layout";
import { getAccentForeground, normalizeHex } from "@/lib/theme/color-utils";
import { DEFAULT_ACCENT_HEX } from "@/lib/theme/constants";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

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

type CardSide = "front" | "back";

function BusinessCardFace({
  side,
  content,
  options,
  accent,
  onAccent,
  coverUrl,
  logoUrl,
  hasCoverImage,
}: {
  side: CardSide;
  content: BusinessCardContent;
  options: BusinessCardOptions;
  accent: string;
  onAccent: string;
  coverUrl: string | null;
  logoUrl: string | null;
  hasCoverImage: boolean;
}) {
  const initials = restaurantInitials(content.name);
  const showCoverStrip = side === "back" && options.showCover && hasCoverImage;

  return (
    <div className="relative flex h-full flex-col overflow-hidden bg-[#fcfcfd]">
      {showCoverStrip && coverUrl ? (
        <div className="relative h-[22%] shrink-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={coverUrl} alt="" className="size-full object-cover" />
          <div
            className="absolute inset-x-0 bottom-0 h-0.5"
            style={{ backgroundColor: accent }}
          />
        </div>
      ) : null}

      {side === "front" ? (
        <div className="flex min-h-0 flex-1 flex-col px-4 py-3.5">
          <h3 className="text-[0.95rem] font-semibold leading-tight tracking-tight text-foreground">
            {content.name}
          </h3>
          <div
            className="mt-1.5 h-0.5 w-10 rounded-full"
            style={{ backgroundColor: accent }}
          />
          <div className="mt-2 space-y-0.5 text-[0.62rem] leading-snug text-muted-foreground">
            {content.addressLines.map((line) => (
              <p key={line}>{line}</p>
            ))}
            {content.phone ? <p>{content.phone}</p> : null}
            {content.websiteLabel ? (
              <p className="font-medium" style={{ color: accent }}>
                {content.websiteLabel}
              </p>
            ) : null}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            "flex min-h-0 flex-1 flex-col px-4 pb-3",
            showCoverStrip ? "pt-2" : "py-3",
          )}
        >
          {options.showLogo ? (
            <div
              className={cn(
                "flex shrink-0 justify-center",
                showCoverStrip ? "mb-2" : "mb-2.5",
              )}
            >
              <div
                className="flex size-12 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-white shadow-md"
                style={{
                  boxShadow: `0 0 0 1.5px ${accent}, 0 6px 16px -6px rgba(15,23,42,0.3)`,
                }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={logoUrl} alt="" className="size-full object-cover" />
                ) : (
                  <span
                    className="flex size-full items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: accent, color: onAccent }}
                  >
                    {initials}
                  </span>
                )}
              </div>
            </div>
          ) : null}

          {content.hourRows.length > 0 ? (
            <div className="min-h-0 flex-1 overflow-hidden">
              <p
                className="mb-1 text-[0.52rem] font-semibold uppercase tracking-[0.12em]"
                style={{ color: accent }}
              >
                Öffnungszeiten
              </p>
              <div className="space-y-0.5 text-[0.52rem] leading-tight text-foreground/80">
                {content.hourRows.map((row) => (
                  <div key={row.label} className="flex gap-1.5">
                    <span className="w-7 shrink-0 font-semibold text-foreground/70">
                      {row.label}
                    </span>
                    <span className="min-w-0 truncate tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {options.showGwadaFooter ? (
            <p className="mt-auto shrink-0 border-t border-border/40 pt-1.5 text-center text-[0.45rem] uppercase tracking-[0.18em] text-muted-foreground/70">
              Erstellt mit Gwada
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}

export function RestaurantBusinessCardPreview({
  content,
  options,
  accentHex,
  coverUrl,
  logoUrl,
  hasCoverImage,
  className,
}: {
  content: BusinessCardContent;
  options: BusinessCardOptions;
  accentHex: string;
  coverUrl: string | null;
  logoUrl: string | null;
  hasCoverImage: boolean;
  className?: string;
}) {
  const [side, setSide] = useState<CardSide>("front");
  const accent = normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX;
  const onAccent = getAccentForeground(accent);

  return (
    <div className={cn("flex w-full max-w-[min(100%,22rem)] flex-col gap-2.5", className)}>
      <div className="flex justify-center gap-1.5">
        <Button
          type="button"
          variant={side === "front" ? "secondary" : "outline"}
          size="sm"
          className="h-8 rounded-full border-border/60 px-3.5 text-xs"
          onClick={() => setSide("front")}
        >
          Vorderseite
        </Button>
        <Button
          type="button"
          variant={side === "back" ? "secondary" : "outline"}
          size="sm"
          className="h-8 rounded-full border-border/60 px-3.5 text-xs"
          onClick={() => setSide("back")}
        >
          Rückseite
        </Button>
      </div>

      <div
        className="mx-auto w-full overflow-hidden rounded-xl border border-border/40 shadow-[0_16px_40px_-20px_rgba(15,23,42,0.4)]"
        style={{ aspectRatio: String(BUSINESS_CARD_ASPECT) }}
      >
        <BusinessCardFace
          side={side}
          content={content}
          options={options}
          accent={accent}
          onAccent={onAccent}
          coverUrl={coverUrl}
          logoUrl={logoUrl}
          hasCoverImage={hasCoverImage}
        />
      </div>
    </div>
  );
}
