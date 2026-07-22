"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { StripeHeroCanvas } from "@/components/landing/stripe-hero-canvas";
import { Button } from "@/components/ui/button";
import { useMarketingHeroLogoSrc } from "@/lib/hooks/use-marketing-hero-logo-src";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";
import { cn } from "@/lib/utils";

/**
 * Marketing-404 im Landing-Look: Blob-Hero, Glas-Karte, Logo, CTA zur Startseite.
 */
export function GwadaNotFoundScreen() {
  const logoUrl = useMarketingHeroLogoSrc();
  const branding = usePlatformAppBrandingOptional();
  const appName = branding?.appName?.trim() || "gwada";

  return (
    <main
      className={cn(
        "relative isolate flex min-h-dvh flex-col items-center justify-center overflow-hidden",
        "bg-[#f4f6fd] px-6 py-16 dark:bg-[#0b1020]",
      )}
    >
      <StripeHeroCanvas />

      <div className="relative z-[2] mx-auto flex w-full max-w-3xl flex-col items-center text-center">
        <div
          className={cn(
            "relative w-full overflow-hidden rounded-[2rem] border border-neutral-200/70 bg-white/80 p-10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-2xl",
            "dark:border-white/10 dark:bg-black/25 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)]",
            "md:p-14",
          )}
        >
          <p
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-x-0 top-1/2 -translate-y-[58%] select-none",
              "text-[clamp(7rem,28vw,14rem)] font-semibold leading-none tracking-tighter",
              "text-neutral-950/[0.06] dark:text-white/[0.07]",
            )}
          >
            404
          </p>

          <div className="landing-hero-rise-logo relative flex flex-col items-center">
            <Link
              href="/"
              prefetch
              aria-label={`${appName} — zur Startseite`}
              className="transition-opacity hover:opacity-90"
            >
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt={appName}
                  width={160}
                  height={56}
                  priority
                  fetchPriority="high"
                  unoptimized
                  sizes="(max-width: 768px) 140px, 180px"
                  className="h-12 w-auto max-w-[11rem] object-contain md:h-14"
                />
              ) : (
                <span className="text-2xl font-semibold tracking-tight text-neutral-950 dark:text-white">
                  {appName}
                </span>
              )}
            </Link>
          </div>

          <h1 className="landing-hero-rise-h1 relative mt-8 text-balance text-3xl font-semibold tracking-tight text-neutral-950 md:text-5xl md:leading-[1.08] dark:text-white">
            Seite nicht gefunden
          </h1>
          <p className="landing-hero-rise-sub relative mx-auto mt-4 max-w-md text-base font-medium text-neutral-500 dark:text-white/70">
            Diese Adresse gibt es nicht — zurück zur {appName}-Startseite und
            weiterplanen.
          </p>

          <div className="landing-hero-rise-cta relative mt-10 flex justify-center">
            <Button
              size="lg"
              className={cn(
                "h-12 min-w-[14rem] gap-2 rounded-full border-0 px-8 text-base font-medium shadow-lg",
                "bg-neutral-900 text-white hover:bg-neutral-800",
                "dark:bg-white dark:text-neutral-900 dark:hover:bg-white/95",
              )}
              render={<Link href="/" prefetch />}
            >
              Zur Startseite
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </div>
        </div>
      </div>
    </main>
  );
}
