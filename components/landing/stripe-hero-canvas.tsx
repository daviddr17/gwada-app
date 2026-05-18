"use client";

import { useReducedMotion } from "framer-motion";

/**
 * Stripe-ähnlicher Hero: große, weich geblurte Farb-Orbs per CSS-Animation
 * (zuverlässig sichtbar in Safari/Chrome). Keine Maus-Parallax — die Glas-Karte
 * in `LandingHero` bewegt sich separat, der Farb-Background bleibt ruhig.
 */
export function StripeHeroCanvas() {
  const reduceMotion = useReducedMotion();

  if (reduceMotion) {
    return (
      <div
        className="pointer-events-none absolute inset-0 z-0 bg-[radial-gradient(ellipse_120%_80%_at_50%_38%,rgba(99,91,255,0.52)_0%,rgba(236,72,153,0.34)_32%,rgba(34,211,238,0.28)_52%,#f4f6fd_100%)] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_38%,rgba(99,91,255,0.45)_0%,rgba(192,38,211,0.3)_40%,#0b1020_100%)]"
        aria-hidden
      />
    );
  }

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-0 bg-[#f4f6fd] dark:bg-[#0b1020]" />

      <div
        className="gwada-hero-blob gwada-hero-blob-a motion-safe:animate-[gwada-hero-blob-a_22s_ease-in-out_infinite]"
        aria-hidden
      />
      <div
        className="gwada-hero-blob gwada-hero-blob-b motion-safe:animate-[gwada-hero-blob-b_26s_ease-in-out_infinite]"
        aria-hidden
      />
      <div
        className="gwada-hero-blob gwada-hero-blob-c motion-safe:animate-[gwada-hero-blob-c_20s_ease-in-out_infinite]"
        aria-hidden
      />
      <div
        className="gwada-hero-blob gwada-hero-blob-d motion-safe:animate-[gwada-hero-blob-d_24s_ease-in-out_infinite]"
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 mix-blend-screen opacity-40 dark:opacity-35"
        style={{
          background:
            "linear-gradient(115deg, transparent 0%, rgba(255,255,255,0.14) 45%, transparent 70%)",
        }}
        aria-hidden
      />
    </div>
  );
}
