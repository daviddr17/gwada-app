"use client";

import {
  LazyMotion,
  domAnimation,
  m,
  useMotionTemplate,
  useSpring,
  useTransform,
} from "framer-motion";
import { useEffect } from "react";
import { LandingHeroCard } from "@/components/landing/landing-hero-card";

type Props = {
  mouse: { x: number; y: number };
  logoUrl: string | null;
  onScrollToSection: (id: string) => void;
};

/** Desktop-Parallax für die Hero-Glas-Karte — LazyMotion, nur bei feinem Pointer geladen. */
export function LandingHeroParallaxCard({
  mouse,
  logoUrl,
  onScrollToSection,
}: Props) {
  const sx = useSpring(mouse.x, { stiffness: 80, damping: 24, mass: 0.4 });
  const sy = useSpring(mouse.y, { stiffness: 80, damping: 24, mass: 0.4 });

  useEffect(() => {
    sx.set(mouse.x);
    sy.set(mouse.y);
  }, [mouse.x, mouse.y, sx, sy]);

  const shiftX = useTransform(sx, [-1, 1], [12, -12]);
  const shiftY = useTransform(sy, [-1, 1], [10, -10]);
  const glareX = useTransform(sx, [-1, 1], [22, 78]);
  const glareY = useTransform(sy, [-1, 1], [18, 82]);
  const glare = useMotionTemplate`radial-gradient(120% 80% at ${glareX}% ${glareY}%, rgba(255,255,255,0.22) 0%, transparent 55%)`;

  return (
    <LazyMotion features={domAnimation} strict>
      <m.div style={{ x: shiftX, y: shiftY }}>
        <LandingHeroCard
          logoUrl={logoUrl}
          onScrollToSection={onScrollToSection}
          overlay={
            <m.div
              className="pointer-events-none absolute inset-0 rounded-[2rem] opacity-70"
              style={{ background: glare }}
            />
          }
        />
      </m.div>
    </LazyMotion>
  );
}
