"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

/** Titelbild mit Scroll-Parallax (wie ursprüngliches Profil-Design). */
export function RestaurantPublicProfileCover({
  coverUrl,
  accentHex,
}: {
  coverUrl: string | null;
  accentHex: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const scale = useTransform(scrollYProgress, [0, 1], [1, 1.14]);
  const y = useTransform(scrollYProgress, [0, 1], [0, 52]);

  return (
    <div ref={ref} className="relative h-44 overflow-hidden sm:h-52 md:h-60">
      {coverUrl ? (
        <motion.div
          className="absolute inset-0"
          style={reduceMotion ? undefined : { scale, y }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={coverUrl}
            alt=""
            className="size-full object-cover"
            decoding="async"
            fetchPriority="high"
          />
        </motion.div>
      ) : (
        <div
          className="absolute inset-0 overflow-hidden"
          style={{
            background: `linear-gradient(135deg, color-mix(in srgb, ${accentHex} 28%, #f4f6fd) 0%, #f4f6fd 45%, color-mix(in srgb, ${accentHex} 12%, white) 100%)`,
          }}
        >
          <div
            className="gwada-hero-blob gwada-hero-blob-a motion-safe:animate-[gwada-hero-blob-a_22s_ease-in-out_infinite] opacity-70"
            aria-hidden
          />
          <div
            className="gwada-hero-blob gwada-hero-blob-b motion-safe:animate-[gwada-hero-blob-b_26s_ease-in-out_infinite] opacity-50"
            aria-hidden
          />
        </div>
      )}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"
        aria-hidden
      />
    </div>
  );
}
