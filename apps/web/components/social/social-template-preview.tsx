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
  shellClass: string;
  panelClass: string;
  heroPad: string;
  leftAccent?: boolean;
};

const PRESET_CHROME: Record<SocialStylePreset, PreviewChrome> = {
  schlicht: {
    surface: "bg-neutral-100 text-neutral-900",
    nameClass: "text-[10px] font-medium uppercase tracking-[0.16em] opacity-70",
    titleClass: "text-xl font-semibold leading-tight tracking-tight",
    captionClass: "line-clamp-3 text-sm opacity-90 whitespace-pre-line",
    barClass: "h-0.5 w-8 rounded-full",
    ctaClass: "self-start rounded-md px-2.5 py-1 text-xs font-medium text-white",
    shellClass: "",
    panelClass: "p-5",
    heroPad: "p-4 pt-14",
  },
  modern: {
    surface: "bg-slate-900 text-slate-50",
    nameClass: "text-[10px] font-semibold uppercase tracking-[0.22em] opacity-65",
    titleClass: "text-2xl font-bold leading-none tracking-tight",
    captionClass: "line-clamp-3 text-sm opacity-85 whitespace-pre-line",
    barClass: "h-1 w-14 rounded-none",
    ctaClass:
      "self-start rounded-none px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-white",
    shellClass: "pl-1",
    panelClass: "p-5",
    heroPad: "p-5 pt-16 pl-6",
    leftAccent: true,
  },
  warm: {
    surface: "bg-[#2a211c] text-[#f7f0e8]",
    nameClass: "text-[11px] font-medium uppercase tracking-[0.14em] opacity-80",
    titleClass: "font-serif text-2xl font-semibold leading-tight",
    captionClass: "line-clamp-3 text-sm opacity-90 whitespace-pre-line",
    barClass: "h-1.5 w-10 rounded-full",
    ctaClass: "self-start rounded-xl px-3 py-1.5 text-xs font-medium text-white",
    shellClass: "",
    panelClass: "m-3 rounded-2xl bg-[#2a211c]/85 p-4",
    heroPad: "p-5 pt-16",
  },
  fancy: {
    surface: "bg-[#140f14] text-[#faf5ff]",
    nameClass: "text-[10px] font-semibold uppercase tracking-[0.28em] opacity-70",
    titleClass: "font-serif text-2xl font-bold leading-tight",
    captionClass: "line-clamp-3 text-sm opacity-90 whitespace-pre-line",
    barClass: "h-0.5 w-8 rounded-none",
    ctaClass: "self-start rounded-full px-4 py-1.5 text-xs font-semibold text-white",
    shellClass: "ring-1 ring-inset ring-white/20",
    panelClass: "m-4 rounded-lg bg-[#120c18]/80 p-5",
    heroPad: "mx-4 mb-4 rounded-lg bg-black/55 p-5 pt-6",
  },
  fein: {
    surface: "bg-neutral-950 text-neutral-100",
    nameClass: "text-[9px] font-medium uppercase tracking-[0.32em] opacity-50",
    titleClass: "font-serif text-xl font-medium leading-snug tracking-wide",
    captionClass: "line-clamp-3 text-xs opacity-70 whitespace-pre-line",
    barClass: "h-px w-6 rounded-none",
    ctaClass:
      "self-start rounded-sm px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-white",
    shellClass: "ring-1 ring-inset ring-white/15",
    panelClass: "m-5 p-5",
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
          chrome.shellClass,
          className,
        )}
        style={
          chrome.leftAccent
            ? ({ borderLeftWidth: 4, borderLeftColor: accentHex } as CSSProperties)
            : stylePreset === "fancy"
              ? ({ ["--tw-ring-color" as string]: `${accentHex}66` } as CSSProperties)
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
            chrome.panelClass,
          )}
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
        chrome.shellClass,
        className,
      )}
      style={
        chrome.leftAccent
          ? ({ borderLeftWidth: 4, borderLeftColor: accentHex } as CSSProperties)
          : stylePreset === "fancy"
            ? ({ ["--tw-ring-color" as string]: `${accentHex}55` } as CSSProperties)
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
          "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 via-black/35 to-transparent text-white",
          chrome.heroPad,
        )}
      >
        <div
          className={cn("mb-2", chrome.barClass)}
          style={{ backgroundColor: accentHex }}
        />
        <p className={cn(chrome.nameClass, "text-white/80")}>{restaurantName}</p>
        {title ? (
          <p className={cn("mt-1 text-white", chrome.titleClass)}>{title}</p>
        ) : null}
        <p className={cn("mt-1 text-white/90", chrome.captionClass)}>{caption}</p>
      </div>
    </div>
  );
}
