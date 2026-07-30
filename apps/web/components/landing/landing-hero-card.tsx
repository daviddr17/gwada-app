"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { LandingHeroAppPreviewPlaceholder } from "@/components/landing/landing-hero-app-preview-placeholder";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/** Code-Split: Tabs/Autoplay nicht im kritischen Hero-JS. */
const LandingHeroAppPreview = dynamic(
  () =>
    import("@/components/landing/landing-hero-app-preview").then((m) => ({
      default: m.LandingHeroAppPreview,
    })),
  {
    ssr: true,
    loading: () => (
      <LandingHeroAppPreviewPlaceholder className="mt-8 md:mt-10" />
    ),
  },
);

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
        "relative w-full max-w-3xl rounded-[1.75rem] border border-neutral-200/70 bg-white/80 p-5 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:rounded-[2rem] sm:p-8 dark:border-white/10 dark:bg-black/25 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] md:p-12",
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
            className="h-9 w-auto max-w-[9rem] object-contain sm:h-10 md:h-12"
          />
        ) : null}
      </div>
      <h1 className="landing-hero-rise-h1 mt-3 text-balance text-[1.7rem] font-semibold leading-[1.12] tracking-tight text-neutral-950 sm:mt-5 sm:text-4xl sm:leading-tight md:text-6xl md:leading-[1.05] dark:text-white">
        Dein digitales Restaurant – alles in einer App.
      </h1>
      <p className="landing-hero-rise-sub mx-auto mt-3 max-w-xl text-pretty text-sm font-medium text-neutral-500 sm:mt-5 sm:text-base md:text-lg dark:text-white/70">
        Speisekarte, Reservierungen, Team und Kanäle — ein System für den ganzen
        Betrieb.
      </p>
      <div className="landing-hero-rise-cta mt-5 flex w-full flex-col items-stretch justify-center gap-2.5 sm:mt-8 sm:w-auto sm:flex-row sm:items-center md:mt-10">
        <Button
          size="lg"
          className="h-11 w-full rounded-full border-0 bg-neutral-900 px-8 text-base font-medium text-white shadow-lg hover:bg-neutral-800 sm:h-12 sm:w-auto sm:min-w-[11rem] dark:bg-white dark:text-neutral-900 dark:hover:bg-white/95"
          render={<Link href="/login" />}
        >
          Jetzt starten
        </Button>
        <Button
          type="button"
          size="lg"
          variant="outline"
          className="h-11 w-full rounded-full border-neutral-300 bg-white/90 px-8 text-base font-medium text-neutral-900 backdrop-blur-md hover:bg-neutral-50 sm:h-12 sm:w-auto dark:border-white/25 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
          onClick={() => onScrollToSection("features")}
        >
          Module entdecken
        </Button>
      </div>
      <LandingHeroAppPreview className="mt-5 sm:mt-8 md:mt-10" />
    </div>
  );
}
