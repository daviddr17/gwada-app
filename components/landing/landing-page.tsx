"use client";

import type Lenis from "lenis";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LandingDock } from "@/components/landing/landing-dock";
import { LandingFeatures } from "@/components/landing/landing-features";
import { LandingHero } from "@/components/landing/landing-hero";
import { LandingPricing } from "@/components/landing/landing-pricing";
import { ModeToggle } from "@/components/theme/mode-toggle";
import { useLandingLenis } from "@/components/landing/use-landing-lenis";
import { usePlatformAppBrandingOptional } from "@/lib/contexts/platform-app-branding-context";

/** Schwere Scroll-Sections erst nach First Paint — gleiche Optik, weniger initiales JS. */
const LandingScrollStory = dynamic(
  () =>
    import("@/components/landing/landing-scroll-story").then((m) => ({
      default: m.LandingScrollStory,
    })),
  { loading: () => <div className="min-h-[80vh]" aria-hidden /> },
);

const LandingIntegrationsScrollStory = dynamic(
  () =>
    import("@/components/landing/landing-integrations-scroll-story").then(
      (m) => ({
        default: m.LandingIntegrationsScrollStory,
      }),
    ),
  { loading: () => <div className="min-h-[70vh]" aria-hidden /> },
);

/**
 * Marketing-Startseite: Lenis + Sektionen + Dock.
 * Maus-Parallax nur für die Hero-Glas-Karte (Hintergrund-Mesh bleibt fix).
 */
export function LandingPage() {
  const branding = usePlatformAppBrandingOptional();
  const appName = branding?.appName ?? "gwada";
  const lenisRef = useLandingLenis();
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  const navigateToSection = useCallback((id: string) => {
    const lenis = lenisRef.current as Lenis | null;
    if (lenis) {
      lenis.scrollTo(`#${id}`, {
        duration: 1.05,
      });
      return;
    }
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [lenisRef]);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      setMouse({
        x: (e.clientX / window.innerWidth) * 2 - 1,
        y: (e.clientY / window.innerHeight) * 2 - 1,
      });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div className="relative min-h-dvh bg-background text-foreground antialiased">
      <div className="pointer-events-none fixed right-5 top-5 z-[60] flex gap-2 md:right-8 md:top-8">
        <div className="pointer-events-auto">
          <ModeToggle />
        </div>
      </div>

      <main>
        <LandingHero mouse={mouse} onScrollToSection={navigateToSection} />
        <LandingScrollStory />
        <LandingFeatures />
        <LandingIntegrationsScrollStory />

        <section
          id="docs"
          className="scroll-mt-28 border-t border-border/50 bg-muted/15 py-28 dark:bg-muted/5"
        >
          <div className="mx-auto max-w-3xl px-6 text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Dokumentation
            </p>
            <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
              Alles, was du zum Start brauchst — gebündelt und klar.
            </h2>
            <p className="mt-5 text-pretty text-lg text-muted-foreground">
              API-Hinweise, Datenmodell und Best Practices folgen hier als
              lebendige Guides. Bis dahin: einloggen und im Dashboard
              ausprobieren.
            </p>
            <Button
              className="mt-10 rounded-full px-8"
              size="lg"
              render={<Link href="/login" prefetch />}
            >
              Zum Dashboard
            </Button>
          </div>
        </section>

        <LandingPricing />

        <footer className="border-t border-border/50 bg-muted/10 px-6 py-20 pb-40 text-center text-sm text-muted-foreground sm:pb-44 dark:bg-muted/5">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} {appName}. Mit Ruhe gebaut.
          </p>
          <p className="mt-2">
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Anmelden
            </Link>
            <span className="mx-2 opacity-40" aria-hidden>
              ·
            </span>
            <Link
              href="/dashboard"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              App öffnen
            </Link>
          </p>
        </footer>
      </main>

      <LandingDock onNavigateSection={navigateToSection} />
    </div>
  );
}
