"use client";

import { useEffect, useMemo, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
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

  useEffect(() => {
    setEnabled(row.enabled);
    const next = row.config as PlatformStripeConfigUi;
    setMode(next.mode ?? "test");
    setPublishableKey(next.publishable_key ?? "");
    setSecretKey("");
    setWebhookSecret("");
    setPriceBasicMonthly(next.price_basic_monthly ?? "");
    setPriceBasicYearly(next.price_basic_yearly ?? "");
    setPriceProMonthly(next.price_pro_monthly ?? "");
    setPriceProYearly(next.price_pro_yearly ?? "");
    setPricePosMonthly(next.price_pos_monthly ?? "");
    setPricePosYearly(next.price_pos_yearly ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
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
      return;
    }
    toast.success("Stripe gespeichert.");
    setSecretKey("");
    setWebhookSecret("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("stripe", dirty, save);

  const credentialsConfigured = Boolean(ui.secret_key_configured);

  return (
    <SuperadminIntegrationPanel
      accentColor={INTEGRATION_PANEL_ACCENT.stripe}
      icon={<CreditCard className="size-5" />}
      title="Stripe (SaaS-Abos)"
      description="Restaurant-Abos Free/Basic/Pro + POS-Add-on. Secrets nur hier — Webhook: /api/billing/stripe/webhook"
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={credentialsConfigured}
          configuredLabel="Secret hinterlegt"
          connection={connection}
          connectionChecking={connectionChecking}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Modus
          </Label>
          <Select
            value={mode}
            onValueChange={(v) => setMode(v === "live" ? "live" : "test")}
          >
            <SelectTrigger className={appSelectTriggerAccentCn("h-9 w-full")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="test">Test</SelectItem>
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
            placeholder="pk_…"
            autoComplete="off"
          />
        </div>
      </div>

      <SecretInput
        id="platform-stripe-secret"
        label="Secret Key"
        configured={Boolean(ui.secret_key_configured)}
        value={secretKey}
        onChange={setSecretKey}
        placeholder="sk_…"
      />
      <SecretInput
        id="platform-stripe-webhook"
        label="Webhook Secret"
        configured={Boolean(ui.webhook_secret_configured)}
        value={webhookSecret}
        onChange={setWebhookSecret}
        placeholder="whsec_…"
      />

      <p className="text-xs text-muted-foreground">
        Price-IDs aus dem Stripe-Dashboard (Products → Prices). Katalogpreise:
        Basic 19/15€, Pro 39/31€, POS 29/23€ (Monatsäquivalent).
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
