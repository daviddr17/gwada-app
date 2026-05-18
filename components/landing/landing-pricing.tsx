"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Free",
    desc: "Zum Ausprobieren — ein Restaurant, Kernfunktionen.",
    monthly: 0,
    yearly: 0,
    cta: "Loslegen",
    href: "/login",
    highlight: false,
  },
  {
    name: "Pro",
    desc: "Für Betriebe, die Tempo, Design und Reservierungen vereinen wollen.",
    monthly: 29,
    yearly: 24,
    cta: "Pro wählen",
    href: "/login",
    highlight: true,
  },
  {
    name: "Enterprise",
    desc: "Dedizierte SLAs, SSO und individuelle Integrationen.",
    monthly: null,
    yearly: null,
    cta: "Kontakt",
    href: "mailto:hello@gwada.app",
    highlight: false,
  },
];

export function LandingPricing() {
  const [yearly, setYearly] = useState(true);

  return (
    <section
      id="pricing"
      className="scroll-mt-28 border-t border-border/50 bg-background py-28"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Preise
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-4xl">
            Transparent. Ruhig. Wie ein Apple-Keynote-Slide.
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Wechsel zwischen monatlich und jährlich — der Mittel-Tier ist für die
            meisten Teams der Sweet Spot.
          </p>

          <div className="mt-10 flex items-center justify-center gap-3">
            <Label
              htmlFor="billing-toggle"
              className={cn(
                "text-sm font-medium",
                !yearly ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Monatlich
            </Label>
            <Switch
              id="billing-toggle"
              checked={yearly}
              onCheckedChange={(v) => setYearly(v === true)}
              aria-label="Abrechnung jährlich oder monatlich"
            />
            <Label
              htmlFor="billing-toggle"
              className={cn(
                "text-sm font-medium",
                yearly ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Jährlich
              <span className="ml-1.5 text-xs font-normal text-emerald-600 dark:text-emerald-400">
                −20%
              </span>
            </Label>
          </div>
        </div>

        <div className="mt-16 grid gap-6 overflow-visible pb-2 lg:grid-cols-3">
          {tiers.map((t, i) => {
            const price =
              t.monthly === null
                ? null
                : yearly
                  ? t.yearly
                  : t.monthly;
            return (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ delay: i * 0.06, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card
                  className={cn(
                    "relative flex h-full flex-col border-border/70 bg-card/90 shadow-none backdrop-blur-sm",
                    "transition-[transform,box-shadow,border-color] duration-300 ease-out",
                    "hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-lg",
                    "dark:hover:border-primary/35 dark:hover:shadow-primary/5",
                    t.highlight &&
                      "z-[1] overflow-visible border-primary/35 shadow-xl ring-2 ring-primary/20 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 lg:scale-[1.02]",
                  )}
                >
                  {t.highlight ? (
                    <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-primary/20 bg-primary px-4 py-1 text-xs font-medium text-primary-foreground shadow-md">
                      Beliebt
                    </Badge>
                  ) : null}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">{t.name}</CardTitle>
                    <CardDescription className="text-base">
                      {t.desc}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col pt-2">
                    <div className="mt-2 flex min-h-[3.5rem] flex-wrap items-baseline gap-1">
                      {price === null ? (
                        <span className="text-3xl font-semibold tracking-tight">
                          Auf Anfrage
                        </span>
                      ) : price === 0 ? (
                        <>
                          <span className="text-4xl font-semibold tracking-tight">
                            Kostenlos
                          </span>
                          <span className="text-sm text-muted-foreground">
                            für immer
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl font-semibold tracking-tight">
                            {price}€
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /Monat
                            {yearly ? " (jährlich)" : ""}
                          </span>
                        </>
                      )}
                    </div>
                    <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                      <li>· Unbegrenzte Menü-Struktur (Fair-Use)</li>
                      <li>· Reservierungen &amp; Übersicht</li>
                      <li>
                        ·{" "}
                        {t.highlight
                          ? "Priorisierter Support"
                          : "Community-Support"}
                      </li>
                    </ul>
                  </CardContent>
                  <CardFooter className="mt-auto border-t-0 pt-2">
                    <Button
                      className="w-full rounded-full"
                      variant={t.highlight ? "default" : "outline"}
                      size="lg"
                      render={
                        t.href.startsWith("mailto") ? (
                          <a href={t.href} />
                        ) : (
                          <Link href={t.href} prefetch />
                        )
                      }
                    >
                      {t.cta}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
