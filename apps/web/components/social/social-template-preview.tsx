"use client";

import type { CSSProperties } from "react";
import type { SocialStylePreset, SocialTemplateId } from "@/lib/social/social-brand-kit";
import { cn } from "@/lib/utils";

type PreviewChrome = {
  surface: string;
  nameClass: string;
  titleClass: string;
  captionClass: string;
  barClass: string;
  ctaClass: string;
  frameClass: string;
  cardClass: string;
  heroPad: string;
};

const PRESET_CHROME: Record<SocialStylePreset, PreviewChrome> = {
  schlicht: {
    surface: "bg-neutral-100 text-neutral-900",
    nameClass: "text-[10px] font-medium uppercase tracking-[0.14em] opacity-70",
    titleClass: "text-xl font-semibold leading-tight tracking-tight",
    captionClass: "line-clamp-3 text-sm opacity-90 whitespace-pre-line",
    barClass: "h-1 w-10 rounded-full",
    ctaClass: "self-start rounded-md px-2.5 py-1 text-xs font-medium text-white",
    frameClass: "",
    cardClass: "",
    heroPad: "p-4 pt-14",
  },
  modern: {
    surface: "bg-slate-100 text-slate-900",
    nameClass: "text-[10px] font-semibold uppercase tracking-[0.22em] opacity-65",
    titleClass: "text-2xl font-bold leading-none tracking-tight",
    captionClass: "line-clamp-3 text-sm opacity-85 whitespace-pre-line",
    barClass: "h-1.5 w-16 rounded-none",
    ctaClass: "self-start rounded-none px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white",
    frameClass: "ring-2 ring-inset",
    cardClass: "m-3 rounded-none bg-white/90 p-4 shadow-sm",
    heroPad: "p-5 pt-16",
  },
  warm: {
    surface: "bg-[#2a211c] text-[#f7f0e8]",
    nameClass: "text-[11px] font-medium uppercase tracking-[0.16em] opacity-80",
    titleClass: "font-serif text-2xl font-semibold leading-tight",
    captionClass: "line-clamp-3 text-sm opacity-90 whitespace-pre-line",
    barClass: "h-1.5 w-12 rounded-full",
    ctaClass: "self-start rounded-xl px-3 py-1.5 text-xs font-medium text-white",
    frameClass: "",
    cardClass: "m-3 rounded-2xl bg-[#2a211c]/85 p-4",
    heroPad: "p-5 pt-16",
  },
  fancy: {
    surface: "bg-[#1a1220] text-[#faf5ff]",
    nameClass: "text-[11px] font-semibold uppercase tracking-[0.28em] opacity-85",
    titleClass: "font-serif text-2xl font-bold leading-tight",
    captionClass: "line-clamp-3 text-sm opacity-95 whitespace-pre-line",
    barClass: "h-1 w-14 rounded-full",
    ctaClass: "self-start rounded-full px-4 py-1.5 text-xs font-semibold text-white",
    frameClass: "ring-4 ring-inset",
    cardClass: "m-4 rounded-3xl bg-[#120c18]/75 p-5 ring-2",
    heroPad: "p-6 pt-20",
  },
  fein: {
    surface: "bg-neutral-950 text-neutral-100",
    nameClass: "text-[9px] font-medium uppercase tracking-[0.32em] opacity-55",
    titleClass: "font-serif text-xl font-medium leading-snug tracking-wide",
    captionClass: "line-clamp-3 text-xs opacity-75 whitespace-pre-line",
    barClass: "h-px w-8 rounded-none",
    ctaClass: "self-start rounded-sm px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white",
    frameClass: "ring-1 ring-inset ring-white/20",
    cardClass: "m-5 rounded-sm bg-black/80 p-5",
    heroPad: "p-6 pt-20",
  },
};

export function SocialTemplatePreview({
  templateId,
  stylePreset,
  accentHex,
  restaurantName,
  title,
  caption,
  imageUrl,
  className,
}: {
  templateId: SocialTemplateId;
  stylePreset: SocialStylePreset;
  accentHex: string;
  restaurantName: string;
  title?: string | null;
  caption: string;
  imageUrl?: string | null;
  className?: string;
}) {
  const chrome = PRESET_CHROME[stylePreset] ?? PRESET_CHROME.schlicht;

  if (templateId === "brand_card") {
    return (
      <div
        className={cn(
          "relative aspect-square overflow-hidden rounded-xl border border-border/50 shadow-card",
          chrome.surface,
          chrome.frameClass,
          className,
        )}
        style={
          stylePreset === "fancy" || stylePreset === "modern"
            ? ({ ["--tw-ring-color" as string]: accentHex } as CSSProperties)
            : undefined
        }
      >
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="absolute inset-0 size-full object-cover opacity-35"
          />
        ) : null}
        <div
          className={cn(
            "relative flex h-full flex-col justify-between",
            chrome.cardClass || "p-5",
          )}
          style={
            stylePreset === "fancy" && chrome.cardClass.includes("ring")
              ? ({ ["--tw-ring-color" as string]: accentHex } as CSSProperties)
              : undefined
          }
        >
          <div className={chrome.barClass} style={{ backgroundColor: accentHex }} />
          <div className="space-y-2">
            <p className={chrome.nameClass}>{restaurantName}</p>
            <p className={chrome.titleClass}>{title?.trim() || "Diese Woche"}</p>
            <p className={chrome.captionClass}>{caption}</p>
          </div>
          <div className={chrome.ctaClass} style={{ backgroundColor: accentHex }}>
            Gwada
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "relative aspect-square overflow-hidden rounded-xl border border-border/50 bg-muted shadow-card",
        chrome.frameClass,
        className,
      )}
      style={
        stylePreset === "fancy" || stylePreset === "modern" || stylePreset === "fein"
          ? ({ ["--tw-ring-color" as string]: accentHex } as CSSProperties)
          : undefined
      }
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="absolute inset-0 size-full object-cover" />
      ) : (
        <div className={cn("absolute inset-0", chrome.surface)} />
      )}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent text-white",
          chrome.heroPad,
        )}
      >
        <div
          className={cn("mb-2", chrome.barClass)}
          style={{ backgroundColor: accentHex }}
        />
        <p className={cn(chrome.nameClass, "text-white/80")}>{restaurantName}</p>
        {title ? <p className={cn("mt-1 text-white", chrome.titleClass)}>{title}</p> : null}
        <p className={cn("mt-1 text-white/90", chrome.captionClass)}>{caption}</p>
      </div>
    </div>
  );
}
