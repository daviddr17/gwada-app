"use client";

import { motion, useMotionTemplate, useSpring, useTransform } from "framer-motion";
import Link from "next/link";
import { useEffect } from "react";
import { LANDING_APP_MODULES } from "@/components/landing/landing-app-modules";
import { Button } from "@/components/ui/button";
import { StripeHeroCanvas } from "@/components/landing/stripe-hero-canvas";
import { useResolvedPlatformLogoSrc } from "@/lib/hooks/use-resolved-platform-logo-src";
import { cn } from "@/lib/utils";

type Props = {
  mouse: { x: number; y: number };
  /** Maus-Parallax nur bei feinem Pointer (Desktop/Maus), nicht auf Touch. */
  parallaxEnabled: boolean;
  onScrollToSection: (id: string) => void;
};

/**
 * Full-viewport Hero: Stripe-Gradient + Glas-Card, starke Typo, CTAs.
 */
export function LandingHero({ mouse, parallaxEnabled, onScrollToSection }: Props) {
  const logoUrl = useResolvedPlatformLogoSrc();

  const sx = useSpring(mouse.x, { stiffness: 80, damping: 24, mass: 0.4 });
  const sy = useSpring(mouse.y, { stiffness: 80, damping: 24, mass: 0.4 });

  useEffect(() => {
    sx.set(mouse.x);
    sy.set(mouse.y);
  }, [mouse.x, mouse.y, sx, sy]);

  /* Entgegengesetzt zur Maus: Maus rechts → Karte leicht nach links */
  const shiftX = useTransform(sx, [-1, 1], [12, -12]);
  const shiftY = useTransform(sy, [-1, 1], [10, -10]);
  const glareX = useTransform(sx, [-1, 1], [22, 78]);
  const glareY = useTransform(sy, [-1, 1], [18, 82]);
  const glare = useMotionTemplate`radial-gradient(120% 80% at ${glareX}% ${glareY}%, rgba(255,255,255,0.22) 0%, transparent 55%)`;

  return (
    <section
      id="home"
      className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden scroll-mt-28 bg-[#f4f6fd] pt-16 pb-24 md:pb-32 dark:bg-[#0b1020]"
    >
      {/* isolate + z-0: Canvas bleibt im Hero-Stacking-Context (nicht hinter der Page-bg) */}
      <StripeHeroCanvas />

      {/* sanfter Übergang zum hellen Body unterhalb des Viewports */}
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-b from-transparent to-background dark:to-background"
        aria-hidden
      />

      <div className="relative z-[2] mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center">
        <motion.div
          style={parallaxEnabled ? { x: shiftX, y: shiftY } : undefined}
          className="relative max-w-3xl rounded-[2rem] border border-neutral-200/70 bg-white/80 p-10 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.12)] backdrop-blur-2xl dark:border-white/10 dark:bg-black/25 dark:shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] md:p-14"
        >
          {parallaxEnabled ? (
            <motion.div
              className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-70"
              style={{ background: glare }}
            />
          ) : null}
          <div className="landing-hero-rise-logo flex flex-col items-center gap-3">
            {logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={logoUrl}
                alt=""
                width={120}
                height={48}
                decoding="async"
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
        </motion.div>
      </div>
    </section>
  );
}
