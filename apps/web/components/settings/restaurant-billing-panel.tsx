"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, CreditCard, Infinity as InfinityIcon, Loader2 } from "lucide-react";
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
  canChangeStripePlan,
  hasManagedStripeSubscription,
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
  const [portalBusy, setPortalBusy] = useState(false);
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
  const managedStripe = Boolean(
    entitlements && hasManagedStripeSubscription(entitlements),
  );
  const dunningOpen = Boolean(
    entitlements &&
      entitlements.source === "stripe" &&
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

  const heroBits = useMemo(
    () => [
      {
        icon: InfinityIcon,
        title: "Keine Seat-Fees in Pro",
        text: "Unbegrenzte Logins ab Pro. Free: 1 registrierter Nutzer, Basic: maximal 3.",
      },
      {
        icon: InfinityIcon,
        title: "Unbegrenzte Reservierungen",
        text: "Kein Monatskontingent — auch im Free-Plan.",
      },
      {
        icon: InfinityIcon,
        title: "Unbegrenzte Speisen",
        text: "Kategorien und Gerichte ohne künstliche Deckel.",
      },
    ],
    [],
  );

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
          data.error === "stripe_not_configured"
            ? "Stripe ist noch nicht freigeschaltet. Bitte Superadmin."
            : data.error === "price_not_configured"
              ? "Stripe-Preise fehlen noch in den Integrationen."
              : data.error === "use_plan_change"
                ? "Bestehendes Abo bitte über Wechseln anpassen."
                : data.error === "payment_required"
                  ? "Zuerst die ausstehende Zahlung im Kundenportal klären."
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
          data.error === "price_not_configured"
            ? "Stripe-Preise fehlen noch in den Integrationen."
            : data.error === "payment_required"
              ? "Zuerst die ausstehende Zahlung im Kundenportal klären."
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
    if (entitlements && canChangeStripePlan(entitlements)) {
      await changePlan(planId);
      return;
    }
    await startCheckout(planId);
  }

  async function openPortal() {
    if (!restaurantId || !canManage) return;
    setPortalBusy(true);
    try {
      const res = await fetch("/api/billing/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (!res.ok || !data.url) {
        toast.error(
          data.error === "no_customer"
            ? "Noch kein Stripe-Kunde — zuerst einen Plan wählen."
            : "Kundenportal nicht verfügbar.",
        );
        return;
      }
      window.location.assign(data.url);
    } finally {
      setPortalBusy(false);
    }
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
        <div className="grid gap-3 md:grid-cols-3">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
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

  return (
    <div className="space-y-6 pt-2">
      <Card className="overflow-hidden border-border/50 shadow-card">
        <CardHeader className="space-y-3 pb-3">
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
          <CardTitle className="text-lg font-semibold tracking-tight">
            Zahlt für Power — nicht für Köpfe
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Andere Tools rechnen pro Mitarbeiter und Reservierung. Gwada nicht:
            unbegrenzte Reservierungen und Speisen in jedem Plan; Nutzer unbegrenzt
            ab Pro (Free: 1 Login, Basic: 3). Ihr upgradet für Module, nicht für Volumen.
            {entitlements?.currentPeriodEnd && managedStripe ? (
              <>
                {" "}
                Laufzeit bis {formatBillingDate(entitlements.currentPeriodEnd)}
                {entitlements.interval === "year" ? " (jährlich)" : " (monatlich)"}.
              </>
            ) : null}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-3">
          {heroBits.map((bit) => (
            <div
              key={bit.title}
              className="rounded-xl border border-border/50 bg-muted/20 px-3 py-3"
            >
              <div className="flex items-center gap-2 text-sm font-medium">
                <bit.icon className="size-4 text-primary" />
                {bit.title}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{bit.text}</p>
            </div>
          ))}
        </CardContent>
      </Card>

      {dunningOpen ? (
        <div className="flex flex-col gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            {entitlements?.pastDueGraceExpired
              ? "Zahlung seit 7 Tagen ausstehend — Paid-Module sind auf Free. Zahlungsmittel aktualisieren (offene Rechnung) oder den Plan erneut wählen."
              : `Zahlung ausstehend — Paid-Module bleiben bis ${formatBillingDate(entitlements?.pastDueAccessEndsAt)} aktiv (maximal 7 Tage). Danach Free.`}
          </p>
          {entitlements?.stripeCustomerId ? (
            <Button
              type="button"
              variant="outline"
              className="shrink-0 rounded-full"
              disabled={portalBusy}
              onClick={() => void openPortal()}
            >
              Zahlungsmittel aktualisieren
            </Button>
          ) : null}
        </div>
      ) : null}

      {managedStripe && entitlements?.cancelAtPeriodEnd ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            Abo endet am {formatBillingDate(entitlements.currentPeriodEnd)} — bis
            dahin bleibt {BILLING_PLANS[currentPlan].name} aktiv, danach Free.
          </p>
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
        </div>
      ) : null}

      {lockedManual ? (
        <p className="rounded-xl border border-border/50 bg-muted/20 px-4 py-3 text-sm text-muted-foreground">
          Dieser Betrieb ist {entitlements?.source === "legacy" ? "im Bestandsschutz" : "komplimentär"}{" "}
          freigeschaltet — Planwechsel läuft nicht über Stripe.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
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

        {entitlements?.stripeCustomerId ? (
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            disabled={portalBusy}
            onClick={() => void openPortal()}
          >
            {portalBusy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CreditCard className="size-4" />
            )}
            Zahlungsmittel & Kündigung
          </Button>
        ) : null}
      </div>

      {entitlements?.addons.includes("pos") ? (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">POS-Kasse</p>
              <Badge className="rounded-full">Aktiv</Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Native Kasse mit TSE ist für diesen Betrieb freigeschaltet.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-medium">POS-Kasse</p>
              <Badge variant="secondary" className="rounded-full text-[10px] font-semibold tracking-wide uppercase">
                Coming soon
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">
              Native Kasse mit TSE — noch nicht zubuchbar. Geplanter Preis{" "}
              {posPrice}€/Monat{yearly ? " (jährlich)" : ""}.
            </p>
          </div>
        </div>
      )}

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
                  {price === 0 ? (
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
                    managedStripe &&
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
                          : managedStripe
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

      <Card className="border-border/50 shadow-card">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">
            In {BILLING_PLANS[currentPlan].name} enthalten
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Kurzüberblick für euren aktuellen Plan — die volle Matrix steht
            darunter.
          </p>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 sm:grid-cols-2">
            {BILLING_PLANS[currentPlan].cardBullets.map((b) => (
              <li key={b} className="flex gap-2 text-sm text-muted-foreground">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
          {entitlements?.addons.includes("pos") ? (
            <p className="mt-4 text-sm text-foreground">
              Zusätzlich aktiv: <span className="font-medium">POS-Add-on</span>{" "}
              (Kasse, TSE, Quittungen).
            </p>
          ) : null}
        </CardContent>
      </Card>

      <RestaurantBillingInvoices
        restaurantId={restaurantId}
        hasStripeCustomer={Boolean(entitlements?.stripeCustomerId)}
        reloadToken={invoiceReload}
      />

      <Card className="border-border/50 shadow-card" id="abo-vergleich">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-base">
            Was ist wann inklusive?
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Free · Basic · Pro im Vergleich. Speisen und Reservierungen ohne Limit.
            Registrierte Nutzer: 1 in Free, 3 in Basic, unbegrenzt in Pro.
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
