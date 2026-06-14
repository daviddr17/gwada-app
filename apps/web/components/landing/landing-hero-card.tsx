"use client";

import Image from "next/image";
import Link from "next/link";
import { LANDING_APP_MODULES } from "@/components/landing/landing-app-modules";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

type Props = {
  logoUrl: string | null;
  onScrollToSection: (id: string) => void;
  className?: string;
  overlay?: ReactNode;
};

/** Hero-Glas-Karte ohne Framer — Mobile/Touch und SSR-Erstrender. */
export function LandingHeroCard({
  logoUrl,
  onScrollToSection,
  className,
  overlay,
}: Props) {
  return (
    <div
      className={cn(
        "relative max-w-3xl rounded-[2rem] border border-neutral-200/70 bg-white/80 p-10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/25 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] md:p-14",
        className,
      )}
    >
      {overlay}
      <div className="landing-hero-rise-logo flex flex-col items-center gap-3">
        {logoUrl ? (
          <Image
            src={logoUrl}
            alt=""
            width={120}
            height={48}
            priority
            fetchPriority="high"
            unoptimized
            sizes="(max-width: 768px) 120px, 192px"
            className="h-10 w-auto max-w-[10rem] object-contain md:h-12"
          />
        ) : null}
      </div>
      <h1 className="landing-hero-rise-h1 mt-5 text-balance text-4xl font-semibold tracking-tight text-neutral-950 md:text-6xl md:leading-[1.05] dark:text-white">
        Dein digitales Restaurant – alles in einer App.
      </h1>
      <p className="landing-hero-rise-sub mt-5 text-sm font-medium text-neutral-500 dark:text-white/70">
        Alles, was dein Betrieb braucht:
      </p>
      <ul
        className="landing-hero-rise-modules mt-4 flex flex-wrap items-center justify-center gap-2"
        aria-label="Module in Gwada"
      >
        {LANDING_APP_MODULES.map(({ label, icon: Icon }) => (
          <li key={label}>
            <span
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-white/70 px-3 py-1.5",
                "text-sm font-medium text-neutral-700 shadow-sm",
                "dark:border-white/15 dark:bg-white/10 dark:text-white/90",
              )}
            >
              <Icon className="size-3.5 shrink-0 opacity-80" strokeWidth={2} aria-hidden />
              {label}
            </span>
          </li>
        ))}
      </ul>
      <div className="landing-hero-rise-cta mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Button
          size="lg"
          className="h-12 min-w-[11rem] rounded-full border-0 bg-neutral-900 px-8 text-base font-medium text-white shadow-lg hover:bg-neutral-800 dark:bg-white dark:text-neutral-900 dark:hover:bg-white/95"
          render={<Link href="/login" />}
        >
          Jetzt starten
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-12 rounded-full border-neutral-300 bg-white/90 px-8 text-base font-medium text-neutral-900 backdrop-blur-md hover:bg-neutral-50 dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          onClick={() => onScrollToSection("features")}
        >
          Funktionen
        </Button>
      </div>
    </div>
  );
}
