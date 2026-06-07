"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { WeatherAmbienceKind } from "@/lib/weather/weather-ambience-kind";
import { useThemeTransitionActive } from "@/lib/hooks/use-theme-transition-active";
import { cn } from "@/lib/utils";

const PALETTES: Record<
  WeatherAmbienceKind,
  { base: string; orbA: string; orbB: string; orbC?: string }
> = {
  clear: {
    base: "from-amber-200/55 via-sky-100/40 to-background",
    orbA: "bg-amber-300/45",
    orbB: "bg-sky-300/35",
    orbC: "bg-orange-200/30",
  },
  night: {
    base: "from-indigo-950/50 via-slate-900/35 to-background",
    orbA: "bg-indigo-400/25",
    orbB: "bg-violet-500/20",
    orbC: "bg-sky-400/15",
  },
  cloudy: {
    base: "from-slate-300/50 via-sky-200/30 to-background",
    orbA: "bg-slate-400/35",
    orbB: "bg-sky-300/28",
  },
  rain: {
    base: "from-slate-400/45 via-sky-300/35 to-background",
    orbA: "bg-sky-400/30",
    orbB: "bg-slate-500/25",
    orbC: "bg-blue-400/20",
  },
  snow: {
    base: "from-sky-100/55 via-slate-100/45 to-background",
    orbA: "bg-white/50",
    orbB: "bg-sky-200/40",
  },
  fog: {
    base: "from-slate-300/40 via-muted/30 to-background",
    orbA: "bg-slate-300/35",
    orbB: "bg-slate-200/30",
  },
  storm: {
    base: "from-slate-600/45 via-indigo-900/35 to-background",
    orbA: "bg-slate-500/35",
    orbB: "bg-indigo-500/28",
    orbC: "bg-violet-600/22",
  },
};

function RainStreaks({ active, animate }: { active: boolean; animate: boolean }) {
  if (!active || !animate) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-30" aria-hidden>
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute top-[-20%] h-[45%] w-px bg-gradient-to-b from-transparent via-sky-300/80 to-transparent"
          style={{ left: `${6 + i * 6.5}%` }}
          initial={{ y: "-100%", opacity: 0 }}
          animate={{ y: ["-100%", "220%"], opacity: [0, 0.7, 0] }}
          transition={{
            duration: 1.1 + (i % 5) * 0.15,
            repeat: Infinity,
            delay: i * 0.12,
            ease: "linear",
          }}
        />
      ))}
    </div>
  );
}

function SnowFlakes({ active, animate }: { active: boolean; animate: boolean }) {
  if (!active || !animate) return null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-40" aria-hidden>
      {Array.from({ length: 10 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute size-1 rounded-full bg-white/80"
          style={{ left: `${8 + i * 9}%`, top: "-4%" }}
          animate={{
            y: ["0%", "110%"],
            x: [0, (i % 2 === 0 ? 8 : -8), 0],
            opacity: [0, 1, 0],
          }}
          transition={{
            duration: 4 + (i % 4),
            repeat: Infinity,
            delay: i * 0.35,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

function DriftingOrb({
  className,
  animate,
}: {
  className: string;
  animate: boolean;
}) {
  if (!animate) {
    return (
      <span
        className={cn("absolute rounded-full blur-3xl", className)}
        aria-hidden
      />
    );
  }
  return (
    <motion.span
      className={cn("absolute rounded-full blur-3xl", className)}
      aria-hidden
      animate={{
        x: [0, 12, -8, 0],
        y: [0, -10, 6, 0],
        scale: [1, 1.06, 0.96, 1],
      }}
      transition={{
        duration: 14,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    />
  );
}

export function DashboardWeatherAmbience({
  kind,
  className,
}: {
  kind: WeatherAmbienceKind;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const themeTransitionActive = useThemeTransitionActive();
  const palette = PALETTES[kind];
  const animate = !reduceMotion && !themeTransitionActive;

  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 overflow-hidden",
        className,
      )}
      aria-hidden
    >
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br",
          palette.base,
        )}
      />
      <DriftingOrb
        animate={animate}
        className={cn(
          "-left-[12%] top-[-18%] size-[58%]",
          palette.orbA,
        )}
      />
      <DriftingOrb
        animate={animate}
        className={cn(
          "right-[-10%] top-[8%] size-[48%]",
          palette.orbB,
        )}
      />
      {palette.orbC ? (
        <DriftingOrb
          animate={animate}
          className={cn(
            "bottom-[-20%] left-[28%] size-[42%]",
            palette.orbC,
          )}
        />
      ) : null}
      <RainStreaks
        active={kind === "rain" || kind === "storm"}
        animate={animate}
      />
      <SnowFlakes active={kind === "snow"} animate={animate} />
      <div className="absolute inset-0 bg-background/55 backdrop-blur-[1px] dark:bg-background/70" />
    </div>
  );
}
