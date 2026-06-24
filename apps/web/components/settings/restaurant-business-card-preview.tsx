"use client";

import {
  BUSINESS_CARD_ASPECT,
  type BusinessCardContent,
  type BusinessCardOptions,
} from "@/lib/restaurant/business-card-layout";
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

export function RestaurantBusinessCardPreview({
  content,
  options,
  accentHex,
  coverUrl,
  logoUrl,
  className,
}: {
  content: BusinessCardContent;
  options: BusinessCardOptions;
  accentHex: string;
  coverUrl: string | null;
  logoUrl: string | null;
  className?: string;
}) {
  const accent = normalizeHex(accentHex) ?? DEFAULT_ACCENT_HEX;
  const onAccent = getAccentForeground(accent);
  const initials = restaurantInitials(content.name);

  return (
    <div
      className={cn(
        "mx-auto w-full max-w-[min(100%,19rem)] overflow-hidden rounded-[1.35rem] border border-border/40 bg-[#fcfcfd] shadow-[0_24px_60px_-28px_rgba(15,23,42,0.45)]",
        className,
      )}
      style={{ aspectRatio: String(BUSINESS_CARD_ASPECT) }}
    >
      <div className="relative flex h-full flex-col">
        <div
          className="relative h-[39%] min-h-[7.5rem] shrink-0 overflow-hidden"
          style={
            options.showCover && coverUrl
              ? undefined
              : {
                  background: `linear-gradient(145deg, color-mix(in srgb, ${accent} 88%, white) 0%, color-mix(in srgb, ${accent} 42%, #141820) 100%)`,
                }
          }
        >
          {options.showCover && coverUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={coverUrl}
                alt=""
                className="size-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0c0e16]/70 via-[#0c0e16]/20 to-transparent" />
            </>
          ) : null}
          <div
            className="absolute inset-x-0 bottom-0 h-1"
            style={{ backgroundColor: accent }}
          />
        </div>

        <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0">
          {options.showLogo ? (
            <div className="relative z-10 -mt-9 mb-3 w-fit">
              <div
                className="flex size-[4.5rem] items-center justify-center overflow-hidden rounded-full border-[3px] border-white bg-white shadow-lg"
                style={{ boxShadow: `0 0 0 2px ${accent}, 0 10px 24px -8px rgba(15,23,42,0.35)` }}
              >
                {logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={logoUrl}
                    alt=""
                    className="size-full object-cover"
                  />
                ) : (
                  <span
                    className="flex size-full items-center justify-center text-lg font-bold"
                    style={{ backgroundColor: accent, color: onAccent }}
                  >
                    {initials}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="pt-4" />
          )}

          <h3 className="text-[1.35rem] font-semibold leading-tight tracking-tight text-foreground">
            {content.name}
          </h3>
          <div
            className="mt-2 h-0.5 w-14 rounded-full"
            style={{ backgroundColor: accent }}
          />

          <div className="mt-3 space-y-1 text-[0.78rem] leading-relaxed text-muted-foreground">
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

          {content.hourRows.length > 0 ? (
            <div className="mt-auto pt-3">
              <p
                className="mb-1.5 text-[0.62rem] font-semibold uppercase tracking-[0.14em]"
                style={{ color: accent }}
              >
                Öffnungszeiten
              </p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 text-[0.62rem] leading-snug text-foreground/80">
                {content.hourRows.map((row) => (
                  <div key={row.label} className="flex gap-1.5">
                    <span className="w-5 shrink-0 font-semibold text-foreground/70">
                      {row.label.slice(0, 2)}
                    </span>
                    <span className="tabular-nums">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {options.showGwadaFooter ? (
            <p className="mt-3 border-t border-border/40 pt-2 text-center text-[0.55rem] uppercase tracking-[0.2em] text-muted-foreground/70">
              Erstellt mit Gwada
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
