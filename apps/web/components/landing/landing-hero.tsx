"use client";

import { useEffect, useState, type ComponentType } from "react";
import { StripeHeroCanvas } from "@/components/landing/stripe-hero-canvas";
import { LandingHeroCard } from "@/components/landing/landing-hero-card";
import { useMarketingHeroLogoSrc } from "@/lib/hooks/use-marketing-hero-logo-src";

type ParallaxProps = {
  mouse: { x: number; y: number };
  logoUrl: string | null;
  onScrollToSection: (id: string) => void;
};

function LandingHeroParallaxLoader(props: ParallaxProps) {
  const [ParallaxCard, setParallaxCard] = useState<ComponentType<ParallaxProps> | null>(
    null,
  );

  useEffect(() => {
    let cancelled = false;
    void import("@/components/landing/landing-hero-parallax-card").then((m) => {
      if (!cancelled) setParallaxCard(() => m.LandingHeroParallaxCard);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!ParallaxCard) {
    return <LandingHeroCard {...props} />;
  }

  return <ParallaxCard {...props} />;
}

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
  const logoUrl = useMarketingHeroLogoSrc();
  const cardProps = { mouse, logoUrl, onScrollToSection };

  return (
    <section
      id="home"
      className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden scroll-mt-28 bg-[#f4f6fd] pt-16 pb-24 md:pb-32 dark:bg-[#0b1020]"
    >
      <StripeHeroCanvas />

      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-40 bg-gradient-to-b from-transparent to-background dark:to-background"
        aria-hidden
      />

      <div className="relative z-[2] mx-auto flex w-full max-w-5xl flex-col items-center px-6 text-center">
        {parallaxEnabled ? (
          <LandingHeroParallaxLoader {...cardProps} />
        ) : (
          <LandingHeroCard logoUrl={logoUrl} onScrollToSection={onScrollToSection} />
        )}
      </div>
    </section>
  );
}
