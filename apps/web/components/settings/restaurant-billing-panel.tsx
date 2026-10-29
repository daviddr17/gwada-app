"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { BillingComparisonTable } from "@/components/billing/billing-comparison-table";
import { RestaurantBillingInvoices } from "@/components/billing/restaurant-billing-invoices";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useRestaurantBilling } from "@/lib/contexts/restaurant-billing-context";
import { formatBillingDate } from "@/lib/billing/billing-status-labels";
import {
  canChangeMolliePlan,
  hasManagedMollieSubscription,
} from "@/lib/billing/entitlements";
import { isBillingDunningStatus } from "@/lib/billing/past-due-grace";
import {
  BILLING_ADDONS,
  BILLING_PLANS,
  priceForInterval,
  yearlySavingsPercent,
  type BillingInterval,
  type BillingPlanId,
} from "@/lib/billing/plan-catalog";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

const PLAN_ORDER: BillingPlanId[] = ["free", "basic", "pro"];

function planStatusLabel(status: string, source: string): string {
  if (source === "legacy") return "Bestandsschutz";
  if (source === "complimentary") return "Komplimentär";
  switch (status) {
    case "active":
      return "Aktiv";
    case "trialing":
      return "Testphase";
    case "past_due":
      return "Zahlung ausstehend";
    case "unpaid":
      return "Zahlung ausstehend";
    case "incomplete":
      return "Zahlung unvollständig";
    case "canceled":
      return "Beendet";
    case "legacy":
      return "Bestandsschutz";
    default:
      return status;
  }
}

export function RestaurantBillingPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const { entitlements, loading: billingLoading, reload } =
    useRestaurantBilling();
  const canManage = has("billing.manage");
  const searchParams = useSearchParams();

  const [yearly, setYearly] = useState(true);
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [invoiceReload, setInvoiceReload] = useState(0);

  const interval: BillingInterval = yearly ? "year" : "month";
  const showSkeleton = useDeferredSkeleton(
    !workspaceReady || permLoading || billingLoading,
  );

  useEffect(() => {
    const checkout = searchParams.get("checkout");
    if (checkout === "success") {
      toast.success("Abo aktualisiert — willkommen an Bord.");
      reload();
      setInvoiceReload((n) => n + 1);
    } else if (checkout === "cancel") {
      toast.message("Checkout abgebrochen.");
    }
  }, [searchParams, reload]);

  useEffect(() => {
    if (!entitlements) return;
    setYearly(entitlements.interval !== "month");
  }, [entitlements?.interval]);

  const currentPlan = entitlements?.planId ?? "free";
  const managedMollie = Boolean(
    entitlements && hasManagedMollieSubscription(entitlements),
  );
  const dunningOpen = Boolean(
    entitlements &&
      entitlements.source === "mollie" &&
      (isBillingDunningStatus(entitlements.status) ||
        entitlements.pastDueGraceExpired),
  );
  const planChangeBlocked = Boolean(
    entitlements &&
      isBillingDunningStatus(entitlements.status) &&
      !entitlements.pastDueGraceExpired,
  );
  const lockedManual =
    entitlements?.source === "complimentary" ||
    entitlements?.source === "legacy";

  async function startCheckout(planId: Exclude<BillingPlanId, "free">) {
    if (!restaurantId || !canManage) return;
    setBusyPlan(planId);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          planId,
          interval,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(
          data.error === "mollie_not_configured"
            ? "Mollie-Billing ist noch nicht freigeschaltet. Bitte Superadmin."
            : data.error === "use_plan_change"
              ? "Bestehendes Abo bitte über Wechseln anpassen."
              : data.error === "payment_required"
                ? "Zuerst die ausstehende Zahlung klären oder den Plan erneut wählen."
                : "Checkout konnte nicht gestartet werden.",
        );
        return;
      }
      window.location.assign(data.url);
    } finally {
      setBusyPlan(null);
    }
  }

  async function changePlan(planId: Exclude<BillingPlanId, "free">) {
    if (!restaurantId || !canManage) return;
    setBusyPlan(planId);
    try {
      const res = await fetch("/api/billing/change-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, planId, interval }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          data.error === "payment_required"
            ? "Zuerst die ausstehende Zahlung klären oder den Plan erneut wählen."
            : data.error === "mollie_not_configured"
              ? "Mollie-Billing ist noch nicht freigeschaltet. Bitte Superadmin."
              : "Planwechsel fehlgeschlagen.",
        );
        return;
      }
      toast.success("Abo aktualisiert.");
      reload();
      setInvoiceReload((n) => n + 1);
    } finally {
      setBusyPlan(null);
    }
  }

  async function setCancelAtPeriodEnd(cancel: boolean) {
    if (!restaurantId || !canManage) return;
    setCancelBusy(true);
    try {
      const res = await fetch("/api/billing/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, cancel }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          cancel
            ? "Kündigung konnte nicht gesetzt werden."
            : "Kündigung konnte nicht zurückgenommen werden.",
        );
        return;
      }
      toast.success(
        cancel
          ? "Abo endet zum Periodenende."
          : "Kündigung zurückgenommen — Abo läuft weiter.",
      );
      reload();
    } finally {
      setCancelBusy(false);
    }
  }

  async function choosePaidPlan(planId: Exclude<BillingPlanId, "free">) {
    if (entitlements && canChangeMolliePlan(entitlements)) {
      await changePlan(planId);
      return;
    }
    await startCheckout(planId);
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }
  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (showSkeleton) {
    return (
      <div className="space-y-4 pt-2">
        <SkeletonCardFrame className="h-28" />
        <Skeleton className="h-10 w-48 rounded-full" />
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!canManage && !permLoading) {
    return (
      <Card className="border-border/50 shadow-card">
        <CardContent className="py-8 text-sm text-muted-foreground">
          Du hast keine Berechtigung, das Abo zu verwalten. Bitte eine Person mit
          der Rolle „Abo & Abrechnung“ oder den Inhaber.
        </CardContent>
      </Card>
    );
  }

  const pos = BILLING_ADDONS.pos;
  const posPrice = priceForInterval(pos.price, interval);
  const savings = yearlySavingsPercent(BILLING_PLANS.pro.price);
  const currentCatalogPrice = priceForInterval(
    BILLING_PLANS[currentPlan].price,
    entitlements?.interval === "month" ? "month" : "year",
  );
  const showGratisPrice = lockedManual || currentCatalogPrice === 0;
  const activeIntervalLabel =
    entitlements?.interval === "month" ? "monatlich" : "jährlich";

  return (
    <div className="space-y-6 pt-2">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="space-y-3 pb-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <CardTitle className="text-lg font-semibold tracking-tight">
                Aktueller Plan
              </CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="rounded-full">
                  {BILLING_PLANS[currentPlan].name}
                </Badge>
                {entitlements ? (
                  <Badge variant="outline" className="rounded-full">
                    {planStatusLabel(entitlements.status, entitlements.source)}
                  </Badge>
                ) : null}
                {entitlements?.addons.includes("pos") ? (
                  <Badge className="rounded-full">POS aktiv</Badge>
                ) : null}
                {entitlements?.cancelAtPeriodEnd ? (
                  <Badge variant="outline" className="rounded-full">
                    Kündigung zum Periodenende
                  </Badge>
                ) : null}
              </div>
            </div>
            {managedMollie && !entitlements?.cancelAtPeriodEnd ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={cancelBusy}
                onClick={() => void setCancelAtPeriodEnd(true)}
              >
                {cancelBusy ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <CreditCard className="size-4" />
                )}
                Abo kündigen
              </Button>
            ) : null}
            {managedMollie && entitlements?.cancelAtPeriodEnd ? (
              <Button
                type="button"
                variant="outline"
                className="shrink-0 rounded-full"
                disabled={cancelBusy}
                onClick={() => void setCancelAtPeriodEnd(false)}
              >
                {cancelBusy ? <Loader2 className="size-4 animate-spin" /> : null}
                Kündigung zurücknehmen
              </Button>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            {showGratisPrice ? (
              <span className="text-2xl font-semibold tracking-tight">0€</span>
            ) : (
              <>
                <span className="text-2xl font-semibold tracking-tight">
                  {currentCatalogPrice}€
                </span>
                <span className="text-sm text-muted-foreground">
                  /Monat · {activeIntervalLabel}
                </span>
              </>
            )}
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            {lockedManual ? (
              <p>
                {entitlements?.source === "legacy"
                  ? "Kostenlos (Bestandsschutz) — kein Abo-Betrag."
                  : "Kostenlos (Kulanz) — kein Abo-Betrag."}
              </p>
            ) : null}
            {entitlements?.currentPeriodEnd && managedMollie ? (
              <p>
                Laufzeit bis {formatBillingDate(entitlements.currentPeriodEnd)}
                {entitlements.cancelAtPeriodEnd
                  ? ` — danach Free`
                  : ` (${activeIntervalLabel})`}
                .
              </p>
            ) : null}
            {!lockedManual && !managedMollie && currentPlan === "free" ? (
              <p>Kostenloser Einstieg — Upgrade unten wählen.</p>
            ) : null}
          </div>
          {entitlements?.addons.includes("pos") ? (
            <p className="text-sm text-foreground">
              POS-Kasse ist für diesen Betrieb freigeschaltet.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              POS-Kasse: Coming soon
              {posPrice > 0
                ? ` · geplant ${posPrice}€/Monat${yearly ? " (jährlich)" : ""}`
                : null}
              .
            </p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              render={<a href="#abo-plan-aendern" />}
            >
              Plan ändern
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full"
              render={<a href="#abo-rechnungen" />}
            >
              Rechnungen
            </Button>
          </div>
        </CardContent>
      </Card>

      {dunningOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {entitlements?.pastDueGraceExpired
              ? "Zahlung seit 7 Tagen ausstehend — Paid-Module sind auf Free. Zahlungsmittel aktualisieren (offene Rechnung) oder den Plan erneut wählen."
              : `Zahlung ausstehend — Paid-Module bleiben bis ${formatBillingDate(entitlements?.pastDueAccessEndsAt)} aktiv (maximal 7 Tage). Danach Free.`}
          </p>
          {managedMollie ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-full"
              disabled={Boolean(busyPlan)}
              onClick={() =>
                void choosePaidPlan(
                  currentPlan === "free" ? "basic" : (currentPlan as "basic" | "pro"),
                )
              }
            >
              Zahlung erneut starten
            </Button>
          ) : null}
        </div>
      ) : null}

      {managedMollie && entitlements?.cancelAtPeriodEnd ? (
        <div className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm">
          Abo endet am {formatBillingDate(entitlements.currentPeriodEnd)} — bis
          dahin bleibt {BILLING_PLANS[currentPlan].name} aktiv, danach Free.
        </div>
      ) : null}

      {lockedManual ? (
        <p className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Dieser Betrieb ist{" "}
          {entitlements?.source === "legacy" ? "im Bestandsschutz" : "komplimentär"}{" "}
          freigeschaltet — Planwechsel läuft nicht über Mollie-Checkout.
        </p>
      ) : null}

      <section id="abo-plan-aendern" className="scroll-mt-24 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-semibold tracking-tight">
              Plan ändern
            </h3>
            <p className="text-sm text-muted-foreground">
              Intervall wählen und auf Free, Basic oder Pro wechseln.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Label
              htmlFor="billing-interval"
              className={cn(
                "text-sm",
                !yearly ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Monatlich
            </Label>
            <Switch
              id="billing-interval"
              checked={yearly}
              onCheckedChange={(v) => setYearly(v === true)}
            />
            <Label
              htmlFor="billing-interval"
              className={cn(
                "text-sm",
                yearly ? "text-foreground" : "text-muted-foreground",
              )}
            >
              Jährlich
              {savings != null ? (
                <span className="ml-1.5 text-xs text-emerald-700 dark:text-emerald-400">
                  −{savings}%
                </span>
              ) : null}
            </Label>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {PLAN_ORDER.map((planId) => {
            const plan = BILLING_PLANS[planId];
            const price = priceForInterval(plan.price, interval);
            const isCurrent = currentPlan === planId;
            const busy = busyPlan === planId;
            return (
              <Card
                key={planId}
                className={cn(
                  "flex flex-col border-border/50 shadow-card",
                  plan.highlight && "ring-2 ring-primary/25",
                  isCurrent && "border-primary/40",
                )}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-lg">{plan.name}</CardTitle>
                    {isCurrent ? (
                      <Badge variant="secondary" className="rounded-full">
                        Aktuell
                      </Badge>
                    ) : plan.highlight ? (
                      <Badge className="rounded-full">Empfohlen</Badge>
                    ) : null}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.tagline}</p>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col gap-4">
                  <div className="flex items-baseline gap-1">
                    {price === 0 || (lockedManual && isCurrent) ? (
                      <span className="text-3xl font-semibold tracking-tight">
                        0€
                      </span>
                    ) : (
                      <>
                        <span className="text-3xl font-semibold tracking-tight">
                          {price}€
                        </span>
                        <span className="text-sm text-muted-foreground">
                          /Monat
                          {yearly ? " · jährlich" : ""}
                        </span>
                      </>
                    )}
                  </div>
                  {lockedManual && isCurrent ? (
                    <p className="text-xs text-muted-foreground">
                      {entitlements?.source === "legacy"
                        ? "Kostenlos (Bestandsschutz) — kein Abo-Betrag."
                        : "Kostenlos (Kulanz) — kein Abo-Betrag."}
                    </p>
                  ) : null}
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    {plan.cardBullets.map((b) => (
                      <li key={b} className="flex gap-2">
                        <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                        <span>{b}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto pt-2">
                    {planId === "free" ? (
                      managedMollie &&
                      !entitlements?.cancelAtPeriodEnd &&
                      !isCurrent ? (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-full"
                          disabled={cancelBusy}
                          onClick={() => void setCancelAtPeriodEnd(true)}
                        >
                          {cancelBusy ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          Zum Periodenende kündigen
                        </Button>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full rounded-full"
                          disabled
                        >
                          {isCurrent
                            ? "Aktueller Plan"
                            : entitlements?.cancelAtPeriodEnd
                              ? "Danach Free"
                              : "Immer inklusive"}
                        </Button>
                      )
                    ) : lockedManual ? (
                      <Button
                        type="button"
                        variant="outline"
                        className="w-full rounded-full"
                        disabled
                      >
                        {isCurrent ? "Aktueller Plan" : "Nicht über Stripe"}
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        className={cn(
                          "w-full",
                          brandActionButtonRoundedClassName,
                        )}
                        disabled={busy || isCurrent || planChangeBlocked}
                        onClick={() =>
                          void choosePaidPlan(
                            planId as Exclude<BillingPlanId, "free">,
                          )
                        }
                      >
                        {busy ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : null}
                        {isCurrent
                          ? "Aktueller Plan"
                          : planChangeBlocked
                            ? "Zahlung klären"
                            : managedMollie
                              ? "Wechseln"
                              : plan.cta}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>

      <section id="abo-rechnungen" className="scroll-mt-24">
        <RestaurantBillingInvoices
          restaurantId={restaurantId}
          hasStripeCustomer={Boolean(entitlements?.mollieCustomerId)}
          reloadToken={invoiceReload}
        />
      </section>

      <Card className="border-border/50 shadow-card" id="abo-vergleich">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">
            Planvergleich
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Free · Basic · Pro im Überblick — Speisen und Reservierungen ohne
            Limit. Registrierte Nutzer: 1 in Free, 3 in Basic, unbegrenzt in Pro.
          </p>
        </CardHeader>
        <CardContent>
          <BillingComparisonTable interval={interval} />
          <p className="mt-4 text-xs text-muted-foreground">
            POS-Kasse: Coming soon, geplanter Preis {pos.price.monthlyEur}€/Monat
            bzw. {pos.price.yearlyPerMonthEur}€/Monat jährlich — noch nicht
            zubuchbar. Gastzahlungen laufen später über den Kassen-PSP, getrennt
            vom Gwada-Abo.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
