"use client";

import type Lenis from "lenis";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { LandingDock } from "@/components/landing/landing-dock";
import { LandingHero } from "@/components/landing/landing-hero";
import { PublicThemeToggleSlot } from "@/components/public/public-theme-toggle-slot";
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

const LandingPricing = dynamic(
  () =>
    import("@/components/landing/landing-pricing").then((m) => ({
      default: m.LandingPricing,
    })),
  { loading: () => <div className="min-h-[65vh]" aria-hidden /> },
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
      <PublicThemeToggleSlot />

      <main>
        <LandingHero mouse={mouse} onScrollToSection={navigateToSection} />
        <LandingScrollStory />
        <LandingIntegrationsScrollStory />

        <LandingPricing />

        <footer className="border-t border-border/50 bg-muted/10 px-6 py-20 pb-40 text-center text-sm text-muted-foreground sm:pb-44 dark:bg-muted/5">
          <p suppressHydrationWarning>
            © {new Date().getFullYear()} {appName}. Mit Ruhe gebaut.
          </p>
          <p className="mt-2 flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link
              href="/login"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Anmelden
            </Link>
            <span className="opacity-40" aria-hidden>
              ·
            </span>
            <Link
              href="/dashboard"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              App öffnen
            </Link>
            <span className="opacity-40" aria-hidden>
              ·
            </span>
            <Link
              href="/docs"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Docs
            </Link>
            <span className="opacity-40" aria-hidden>
              ·
            </span>
            <Link
              href="/impressum"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Impressum
            </Link>
            <span className="opacity-40" aria-hidden>
              ·
            </span>
            <Link
              href="/datenschutz"
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              Datenschutz
            </Link>
          </p>
        </footer>
      </main>

      <LandingDock onNavigateSection={navigateToSection} />
    </div>
  );
}
