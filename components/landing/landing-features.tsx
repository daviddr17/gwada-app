"use client";

import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { LANDING_FEATURE_ITEMS } from "@/components/landing/landing-feature-items";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const container = {
  hidden: {},
  show: {
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};

const itemV = {
  hidden: { opacity: 0, y: 18 },
  show: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] as const },
  },
};

export function LandingFeatures() {
  return (
    <section
      id="features"
      className="scroll-mt-28 border-t border-border/50 bg-muted/20 py-28 dark:bg-muted/10"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            <Sparkles className="size-3.5" aria-hidden />
            Funktionen
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Alles, was ein moderner Betrieb braucht — ohne Überladung.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Jede Karte ist ruhig typografiert, mit sanften Hover- und Fokus-States
            im Apple-Stil.
          </p>
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-60px" }}
          className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          {LANDING_FEATURE_ITEMS.map((it) => (
            <motion.div key={it.title} variants={itemV}>
              <Card
                className={cn(
                  "group h-full border-border/60 bg-card/80 shadow-none backdrop-blur-sm transition-[transform,box-shadow,border-color] duration-300 ease-out",
                  "hover:-translate-y-0.5 hover:border-border hover:shadow-lg dark:bg-card/60",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15 transition-transform duration-300 group-hover:scale-[1.03] dark:bg-primary/12">
                    <it.icon className="size-5" aria-hidden />
                  </div>
                  <CardTitle className="pt-3 text-lg">{it.title}</CardTitle>
                  <CardDescription className="text-base leading-relaxed">
                    {it.description}
                  </CardDescription>
                </CardHeader>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
