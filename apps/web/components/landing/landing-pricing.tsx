"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Check } from "lucide-react";
import { BillingComparisonTable } from "@/components/billing/billing-comparison-table";
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
import {
  BILLING_ADDONS,
  BILLING_PLANS,
  priceForInterval,
  yearlySavingsPercent,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { cn } from "@/lib/utils";

const PLAN_ORDER: BillingPlanId[] = ["free", "basic", "pro"];

export function LandingPricing() {
  const [yearly, setYearly] = useState(true);
  const interval: BillingInterval = yearly ? "year" : "month";
  const savings = yearlySavingsPercent(BILLING_PLANS.pro.price);
  const pos = BILLING_ADDONS.pos;
  const posPrice = priceForInterval(pos.price, interval);

  return (
    <section
      id="pricing"
      className="relative scroll-mt-28 overflow-hidden border-t border-border/50 py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,var(--accent)_0%,transparent_55%)] opacity-[0.07] dark:opacity-[0.12]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-border to-transparent"
      />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
            Preise
          </p>
          <h2 className="mt-4 text-balance text-3xl font-semibold tracking-tight md:text-5xl md:leading-[1.1]">
            Zahlt für Power — nicht für Köpfe
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Unbegrenzte Mitarbeiter, Reservierungen und Speisen in jedem Plan.
            Keine Seat-Fees. Upgrade für Module — nicht für Volumen.
          </p>

          <div className="mt-10 inline-flex items-center gap-3 rounded-full border border-border/60 bg-card/80 px-4 py-2 shadow-sm backdrop-blur-sm">
            <Label
              htmlFor="billing-toggle"
              className={cn(
                "cursor-pointer text-sm font-medium",
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
                "cursor-pointer text-sm font-medium",
                yearly ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Jährlich
              {savings != null ? (
                <span className="ml-1.5 rounded-full bg-emerald-500/12 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                  −{savings}%
                </span>
              ) : null}
            </Label>
          </div>
        </div>

        <div className="mt-16 grid gap-5 overflow-visible pb-2 lg:grid-cols-3 lg:gap-6">
          {PLAN_ORDER.map((planId, i) => {
            const t = BILLING_PLANS[planId];
            const price = priceForInterval(t.price, interval);
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 22 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{
                  delay: i * 0.06,
                  duration: 0.45,
                  ease: [0.22, 1, 0.36, 1],
                }}
              >
                <Card
                  className={cn(
                    "relative flex h-full flex-col border-border/70 bg-card/90 shadow-none backdrop-blur-sm",
                    "transition-[border-color,background-color,box-shadow] duration-300 ease-out",
                    "hover:border-accent/45 hover:bg-accent/[0.07] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--accent)_28%,transparent),0_18px_40px_-28px_color-mix(in_srgb,var(--accent)_35%,transparent)]",
                    "dark:hover:border-accent/55 dark:hover:bg-accent/10",
                    t.highlight &&
                      "z-[1] overflow-visible border-primary/40 bg-primary/[0.04] shadow-none ring-2 ring-primary/20 lg:scale-[1.03]",
                    t.highlight &&
                      "hover:border-primary/55 hover:bg-primary/[0.09] hover:shadow-[0_0_0_1px_color-mix(in_srgb,var(--primary)_35%,transparent),0_22px_48px_-28px_color-mix(in_srgb,var(--primary)_40%,transparent)] hover:ring-primary/35",
                  )}
                >
                  {t.highlight ? (
                    <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-primary/20 bg-primary px-4 py-1 text-xs font-medium text-primary-foreground shadow-md">
                      Empfohlen
                    </Badge>
                  ) : null}
                  <CardHeader className="pb-2">
                    <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                      {t.tagline}
                    </p>
                    <CardTitle className="mt-1 text-2xl tracking-tight">
                      {t.name}
                    </CardTitle>
                    <CardDescription className="text-base leading-relaxed">
                      {t.pitch}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col pt-2">
                    <div className="mt-2 flex min-h-[3.75rem] flex-wrap items-baseline gap-x-1.5 gap-y-0">
                      {price === 0 ? (
                        <>
                          <span className="text-4xl font-semibold tracking-tight md:text-5xl">
                            0€
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /Monat · für immer
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-4xl font-semibold tracking-tight md:text-5xl">
                            {price}€
                          </span>
                          <span className="text-sm text-muted-foreground">
                            /Monat
                            {yearly ? (
                              <span className="block text-xs sm:inline sm:before:content-['·_']">
                                jährlich abgerechnet
                              </span>
                            ) : null}
                          </span>
                        </>
                      )}
                    </div>
                    <ul className="mt-8 space-y-3 text-sm text-muted-foreground">
                      {t.cardBullets.map((b) => (
                        <li key={b} className="flex gap-2.5">
                          <span
                            className={cn(
                              "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition-colors duration-300",
                              t.highlight
                                ? "group-hover/card:bg-primary/20"
                                : "group-hover/card:bg-accent/20 group-hover/card:text-accent",
                            )}
                          >
                            <Check className="size-3" strokeWidth={2.5} />
                          </span>
                          <span className="leading-snug text-foreground/85">
                            {b}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  <CardFooter className="mt-auto border-t-0 pt-2">
                    <Button
                      className="w-full rounded-full"
                      variant={t.highlight ? "default" : "outline"}
                      size="lg"
                      render={<Link href="/login" prefetch />}
                    >
                      {t.cta}
                    </Button>
                  </CardFooter>
                </Card>
              </motion.div>
            );
          })}
        </div>

        <motion.div
          className="mt-8 overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-muted/40 via-card/80 to-card px-6 py-7 md:px-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-xl">
              <p className="text-[11px] font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                Optional · Add-on
              </p>
              <h3 className="mt-2 text-2xl font-semibold tracking-tight">
                {pos.name} — {posPrice}€
                <span className="text-base font-normal text-muted-foreground">
                  /Monat
                  {yearly ? " · jährlich" : ""}
                </span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {pos.pitch} Zu Free, Basic und Pro zubuchbar.
              </p>
            </div>
            <ul className="grid gap-2 text-sm sm:grid-cols-2 lg:max-w-md">
              {pos.cardBullets.slice(0, 4).map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  <span className="text-foreground/85">{b}</span>
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <div className="mt-24">
          <div className="mx-auto mb-10 max-w-2xl text-center">
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Vergleich
            </p>
            <h3 className="mt-3 text-balance text-2xl font-semibold tracking-tight md:text-3xl">
              Alle Funktionen im Überblick
            </h3>
            <p className="mt-3 text-pretty text-muted-foreground">
              Free startet ohne Seat-Fees und ohne Limits bei Speisen,
              Reservierungen und Team-Zugängen — Module kommen mit Basic und
              Pro dazu.
            </p>
          </div>
          <BillingComparisonTable variant="landing" interval={interval} />
        </div>
      </div>
    </section>
  );
}
