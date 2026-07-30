"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";
import { Check, Infinity as InfinityIcon } from "lucide-react";
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
            Zahlt für Power — nicht für Köpfe
          </h2>
          <p className="mt-4 text-pretty text-muted-foreground md:text-lg">
            Unbegrenzte Mitarbeiter, Reservierungen und Speisen in jedem Plan.
            Keine Seat-Fees. Ihr upgradet für Module — nicht für Volumen.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-sm">
            {[
              "Keine Seat-Fees",
              "Unbegrenzte Reservierungen",
              "Unbegrenzte Speisen",
            ].map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-muted/30 px-3 py-1"
              >
                <InfinityIcon className="size-3.5 text-primary" />
                {label}
              </span>
            ))}
          </div>

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
              {savings != null ? (
                <span className="ml-1.5 text-xs font-normal text-emerald-700 dark:text-emerald-400">
                  −{savings}%
                </span>
              ) : null}
            </Label>
          </div>
        </div>

        <div className="mt-16 grid gap-6 overflow-visible pb-2 lg:grid-cols-3">
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
                    "transition-[transform,box-shadow,border-color] duration-300 ease-out",
                    "hover:-translate-y-1.5 hover:border-primary/25 hover:shadow-lg",
                    "dark:hover:border-primary/35 dark:hover:shadow-primary/5",
                    t.highlight &&
                      "z-[1] overflow-visible border-primary/35 shadow-xl ring-2 ring-primary/20 hover:-translate-y-2 hover:shadow-2xl hover:shadow-primary/10 lg:scale-[1.02]",
                  )}
                >
                  {t.highlight ? (
                    <Badge className="absolute -top-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-primary/20 bg-primary px-4 py-1 text-xs font-medium text-primary-foreground shadow-md">
                      Empfohlen
                    </Badge>
                  ) : null}
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xl">{t.name}</CardTitle>
                    <CardDescription className="text-base">
                      {t.pitch}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col pt-2">
                    <div className="mt-2 flex min-h-[3.5rem] flex-wrap items-baseline gap-1">
                      {price === 0 ? (
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
                      {t.cardBullets.map((b) => (
                        <li key={b} className="flex gap-2">
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                          <span>{b}</span>
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
          className="mt-10 rounded-2xl border border-border/60 bg-muted/20 px-6 py-6 md:px-8"
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-40px" }}
          transition={{ duration: 0.45 }}
        >
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
                Optional
              </p>
              <h3 className="mt-2 text-xl font-semibold tracking-tight">
                {pos.name}-Add-on — {priceForInterval(pos.price, interval)}€/Monat
                {yearly ? " (jährlich)" : ""}
              </h3>
              <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                {pos.pitch} Zu jedem Plan buchbar.
              </p>
            </div>
            <ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
              {pos.cardBullets.slice(0, 4).map((b) => (
                <li key={b} className="flex gap-2">
                  <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                  {b}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        <div className="mt-20">
          <div className="mx-auto mb-8 max-w-2xl text-center">
            <h3 className="text-2xl font-semibold tracking-tight">
              Genau wissen, was wann dabei ist
            </h3>
            <p className="mt-3 text-muted-foreground">
              Die Highlights ohne Limit gelten für Free, Basic und Pro — das ist
              der Deal, den man bei Restaurant-Software fast nirgends bekommt.
            </p>
          </div>
          <BillingComparisonTable />
        </div>
      </div>
    </section>
  );
}
