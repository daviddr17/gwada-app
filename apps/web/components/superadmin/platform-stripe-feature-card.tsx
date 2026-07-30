"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard, FlaskConical, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import type { PlatformStripeConfigUi } from "@/lib/integrations/platform-stripe-config";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

export function PlatformStripeFeatureCard({
  row,
  onSaved,
  connection,
  connectionChecking,
}: {
  row: PlatformIntegrationRow;
  onSaved: () => void;
  connection?: SuperadminIntegrationConnectionHealth | null;
  connectionChecking?: boolean;
}) {
  const ui = row.config as PlatformStripeConfigUi;
  const [enabled, setEnabled] = useState(row.enabled);
  const [mode, setMode] = useState<"test" | "live">(ui.mode ?? "test");
  const [publishableKey, setPublishableKey] = useState(
    ui.publishable_key ?? "",
  );
  const [secretKey, setSecretKey] = useState("");
  const [webhookSecret, setWebhookSecret] = useState("");
  const [priceBasicMonthly, setPriceBasicMonthly] = useState(
    ui.price_basic_monthly ?? "",
  );
  const [priceBasicYearly, setPriceBasicYearly] = useState(
    ui.price_basic_yearly ?? "",
  );
  const [priceProMonthly, setPriceProMonthly] = useState(
    ui.price_pro_monthly ?? "",
  );
  const [priceProYearly, setPriceProYearly] = useState(
    ui.price_pro_yearly ?? "",
  );
  const [pricePosMonthly, setPricePosMonthly] = useState(
    ui.price_pos_monthly ?? "",
  );
  const [pricePosYearly, setPricePosYearly] = useState(
    ui.price_pos_yearly ?? "",
  );
  const [seeding, setSeeding] = useState(false);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        mode: ui.mode ?? "test",
        publishable_key: ui.publishable_key ?? "",
        price_basic_monthly: ui.price_basic_monthly ?? "",
        price_basic_yearly: ui.price_basic_yearly ?? "",
        price_pro_monthly: ui.price_pro_monthly ?? "",
        price_pro_yearly: ui.price_pro_yearly ?? "",
        price_pos_monthly: ui.price_pos_monthly ?? "",
        price_pos_yearly: ui.price_pos_yearly ?? "",
      }),
    [row.enabled, ui],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      mode,
      publishable_key: publishableKey,
      price_basic_monthly: priceBasicMonthly,
      price_basic_yearly: priceBasicYearly,
      price_pro_monthly: priceProMonthly,
      price_pro_yearly: priceProYearly,
      price_pos_monthly: pricePosMonthly,
      price_pos_yearly: pricePosYearly,
    });
    return (
      current !== snapshot || secretKey.length > 0 || webhookSecret.length > 0
    );
  }, [
    enabled,
    mode,
    publishableKey,
    priceBasicMonthly,
    priceBasicYearly,
    priceProMonthly,
    priceProYearly,
    pricePosMonthly,
    pricePosYearly,
    secretKey,
    webhookSecret,
    snapshot,
  ]);

  function applyUiProfile(
    next: PlatformStripeConfigUi,
    nextMode: "test" | "live",
  ) {
    const profile = nextMode === "live" ? next.live : next.test;
    const src = profile ?? next;
    setPublishableKey(src.publishable_key ?? "");
    setSecretKey("");
    setWebhookSecret("");
    setPriceBasicMonthly(src.price_basic_monthly ?? "");
    setPriceBasicYearly(src.price_basic_yearly ?? "");
    setPriceProMonthly(src.price_pro_monthly ?? "");
    setPriceProYearly(src.price_pro_yearly ?? "");
    setPricePosMonthly(src.price_pos_monthly ?? "");
    setPricePosYearly(src.price_pos_yearly ?? "");
  }

  useEffect(() => {
    setEnabled(row.enabled);
    const next = row.config as PlatformStripeConfigUi;
    const nextMode = next.mode ?? "test";
    setMode(nextMode);
    applyUiProfile(next, nextMode);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async (): Promise<boolean> => {
    const config: Record<string, unknown> = {
      mode,
      publishable_key: publishableKey.trim(),
      price_basic_monthly: priceBasicMonthly.trim(),
      price_basic_yearly: priceBasicYearly.trim(),
      price_pro_monthly: priceProMonthly.trim(),
      price_pro_yearly: priceProYearly.trim(),
      price_pos_monthly: pricePosMonthly.trim(),
      price_pos_yearly: pricePosYearly.trim(),
    };
    if (secretKey.trim()) config.secret_key = secretKey.trim();
    if (webhookSecret.trim()) config.webhook_secret = webhookSecret.trim();

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "stripe",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return false;
    }
    toast.success(
      mode === "test"
        ? "Stripe Sandbox (Test) gespeichert."
        : "Stripe Live gespeichert.",
    );
    setSecretKey("");
    setWebhookSecret("");
    onSaved();
    return true;
  };

  useRegisterSuperadminIntegrationSave("stripe", dirty, async () => {
    await save();
  });

  async function seedCatalog() {
    setSeeding(true);
    try {
      // Erst speichern, damit Secret in der DB liegt (falls neu eingegeben)
      if (dirty) {
        const saved = await save();
        if (!saved) return;
      }
      const res = await fetch("/api/superadmin/stripe/seed-catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          secretKey: secretKey.trim() || undefined,
        }),
      });
      const data = (await res.json()) as {
        error?: string;
        mode?: string;
        prices?: Record<string, string>;
        webhookSecretSaved?: boolean;
        webhookSkippedLocalhost?: boolean;
      };
      if (!res.ok) {
        toast.error(
          data.error === "secret_key_missing"
            ? "Zuerst einen Secret Key speichern (sk_test_… für Sandbox)."
            : data.error === "secret_key_not_test"
              ? "Sandbox braucht einen sk_test_ / rk_test_ Key."
              : data.error === "secret_key_not_live"
                ? "Live-Modus braucht einen sk_live_ / rk_live_ Key."
                : data.error ?? "Katalog konnte nicht angelegt werden.",
        );
        return;
      }
      toast.success(
        data.mode === "test"
          ? "Test-Katalog angelegt (Sandbox)."
          : "Live-Katalog angelegt.",
      );
      if (data.webhookSkippedLocalhost) {
        toast.message(
          "Webhook übersprungen (localhost). Für lokal: stripe listen --forward-to localhost:3000/api/billing/stripe/webhook",
        );
      } else if (data.webhookSecretSaved) {
        toast.message("Webhook-Secret wurde automatisch gespeichert.");
      }
      onSaved();
    } finally {
      setSeeding(false);
    }
  }

  const credentialsConfigured = Boolean(ui.secret_key_configured);
  const catalogReady = Boolean(
    ui.price_basic_monthly && ui.price_pro_monthly && ui.price_pos_monthly,
  );

  return (
    <SuperadminIntegrationPanel
      accentColor={INTEGRATION_PANEL_ACCENT.stripe}
      icon={<CreditCard className="size-5" />}
      title="Stripe (SaaS-Abos)"
      description="Free/Basic/Pro + POS. Dev → Modus Test (Sandbox). Live → Modus Live. Secrets nur hier."
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={credentialsConfigured}
          configuredLabel={
            mode === "test" ? "Test-Key hinterlegt" : "Live-Key hinterlegt"
          }
          connection={connection}
          connectionChecking={connectionChecking}
          extra={
            mode === "test" ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-900 dark:text-amber-100">
                <FlaskConical className="size-3" />
                Sandbox
              </span>
            ) : null
          }
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Stripe Billing aktivieren"
        />
      }
    >
      {mode === "test" ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-3 text-sm text-muted-foreground">
          <p className="font-medium text-foreground">Dev-Sandbox</p>
          <ol className="mt-2 list-decimal space-y-1 pl-4">
            <li>
              Stripe Dashboard →{" "}
              <span className="font-medium text-foreground">Test mode</span> →
              API keys → <code className="text-xs">sk_test_…</code> hier
              einfügen
            </li>
            <li>
              Speichern, dann{" "}
              <span className="font-medium text-foreground">
                Test-Katalog anlegen
              </span>
            </li>
            <li>
              Stripe aktivieren → in der App unter Einstellungen → Abo mit{" "}
              <code className="text-xs">4242 4242 4242 4242</code> zahlen
            </li>
          </ol>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Live-Modus: echte Abbuchungen. Webhook:{" "}
          <code className="text-xs">/api/billing/stripe/webhook</code>
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Modus
          </Label>
          <Select
            value={mode}
            onValueChange={(v) => {
              const nextMode = v === "live" ? "live" : "test";
              setMode(nextMode);
              applyUiProfile(ui, nextMode);
            }}
          >
            <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test / Sandbox</SelectItem>
              <SelectItem value="live">Live</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Publishable Key
          </Label>
          <Input
            className={superadminIntegrationInputClassName}
            value={publishableKey}
            onChange={(e) => setPublishableKey(e.target.value)}
            placeholder={mode === "test" ? "pk_test_…" : "pk_live_…"}
            autoComplete="off"
          />
        </div>
      </div>

      <SecretInput
        id="platform-stripe-secret"
        label={mode === "test" ? "Secret Key (sk_test_…)" : "Secret Key (sk_live_…)"}
        configured={Boolean(ui.secret_key_configured)}
        value={secretKey}
        onChange={setSecretKey}
        placeholder={mode === "test" ? "sk_test_…" : "sk_live_…"}
        hint={
          mode === "test"
            ? "Nur Test-Keys. Live-Keys gehören in den Live-Modus."
            : undefined
        }
      />
      <SecretInput
        id="platform-stripe-webhook"
        label="Webhook Secret"
        configured={Boolean(ui.webhook_secret_configured)}
        value={webhookSecret}
        onChange={setWebhookSecret}
        placeholder="whsec_…"
        hint="Wird beim Katalog-Anlegen oft automatisch gesetzt (außer localhost)."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          className={cn(brandActionButtonRoundedClassName)}
          disabled={seeding}
          onClick={() => void seedCatalog()}
        >
          {seeding ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <FlaskConical className="size-4" />
          )}
          {mode === "test" ? "Test-Katalog anlegen" : "Live-Katalog anlegen"}
        </Button>
        {catalogReady ? (
          <span className="text-xs text-emerald-700 dark:text-emerald-300">
            Price-IDs vorhanden
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">
            Noch keine Price-IDs für diesen Modus
          </span>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Katalogpreise: Basic 19/15€ · Pro 39/31€ · POS 29/23€ (Monatsäquivalent).
        Test und Live haben getrennte Price-IDs.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        {(
          [
            ["Basic monatlich", priceBasicMonthly, setPriceBasicMonthly],
            ["Basic jährlich", priceBasicYearly, setPriceBasicYearly],
            ["Pro monatlich", priceProMonthly, setPriceProMonthly],
            ["Pro jährlich", priceProYearly, setPriceProYearly],
            ["POS monatlich", pricePosMonthly, setPricePosMonthly],
            ["POS jährlich", pricePosYearly, setPricePosYearly],
          ] as const
        ).map(([label, value, setValue]) => (
          <div key={label} className="space-y-1.5">
            <Label className={superadminIntegrationFieldLabelClassName}>
              {label}
            </Label>
            <Input
              className={superadminIntegrationInputClassName}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="price_…"
              autoComplete="off"
            />
          </div>
        ))}
      </div>
    </SuperadminIntegrationPanel>
  );
}
