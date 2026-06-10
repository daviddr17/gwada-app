"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  SuperadminIntegrationPanel,
  superadminIntegrationFieldLabelClassName,
  superadminIntegrationInputClassName,
} from "@/components/superadmin/superadmin-integration-panel";
import { SuperadminIntegrationStatusBadges } from "@/components/superadmin/superadmin-integration-status-badges";
import { FiskalyProvisionResultsPanel } from "@/components/superadmin/fiskaly-provision-results-panel";
import { FiskalyReconcileDialog } from "@/components/superadmin/fiskaly-reconcile-dialog";
import { FiskalyStandorteTable } from "@/components/superadmin/fiskaly-standorte-table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SecretInput } from "@/components/ui/secret-input";
import { Switch } from "@/components/ui/switch";
import { useRegisterSuperadminIntegrationSave } from "@/lib/superadmin/integrations-save-registry";
import {
  confirmFiskalyReconcileRestaurant,
  fetchFiskalyProvisionOverview,
  previewFiskalyReconcileRestaurant,
  provisionFiskalyRestaurants,
  type FiskalyProvisionLocation,
  type FiskalyProvisionOverview,
  type FiskalyProvisionResult,
  type FiskalyReconcilePreview,
} from "@/lib/superadmin/fiskaly-provision-api";
import { saveSuperadminPlatformIntegration } from "@/lib/superadmin/platform-integrations-api";
import type { PlatformFiskalyConfigUi } from "@/lib/integrations/platform-fiskaly-config";
import type { PlatformIntegrationRow } from "@/lib/types/platform-integration";
import type { SuperadminIntegrationConnectionHealth } from "@/lib/types/superadmin-ops-status";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

const DEFAULT_SIGN_DE_BASE_URL =
  "https://kassensichv-middleware.fiskaly.com/api/v2";
const DEFAULT_ERECEIPT_BASE_URL = "https://receipt.fiskaly.com/api/v1";

export function PlatformFiskalyFeatureCard({
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
  const ui = row.config as PlatformFiskalyConfigUi;
  const [enabled, setEnabled] = useState(row.enabled);
  const [env, setEnv] = useState<"TEST" | "LIVE">(ui.env ?? "TEST");
  const [signDeBaseUrl, setSignDeBaseUrl] = useState(
    ui.sign_de_base_url ?? DEFAULT_SIGN_DE_BASE_URL,
  );
  const [eReceiptBaseUrl, setEReceiptBaseUrl] = useState(
    ui.ereceipt_base_url ?? DEFAULT_ERECEIPT_BASE_URL,
  );
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const apiKeyConfigured = Boolean(ui.api_key_configured);
  const apiSecretConfigured = Boolean(ui.api_secret_configured);
  const credentialsConfigured = apiKeyConfigured && apiSecretConfigured;
  const [overview, setOverview] = useState<FiskalyProvisionOverview | null>(
    null,
  );
  const [provisionLoading, setProvisionLoading] = useState(false);
  const [provisioning, setProvisioning] = useState(false);
  const [busyRestaurantId, setBusyRestaurantId] = useState<string | null>(null);
  const [bulkResults, setBulkResults] = useState<FiskalyProvisionResult[] | null>(
    null,
  );
  const [reconcileOpen, setReconcileOpen] = useState(false);
  const [reconcilePreview, setReconcilePreview] =
    useState<FiskalyReconcilePreview | null>(null);
  const [reconcileLoading, setReconcileLoading] = useState(false);

  const loadOverview = useCallback(
    async (checkRemote = false) => {
      if (!enabled || !credentialsConfigured) {
        setOverview(null);
        return;
      }
      setProvisionLoading(true);
      const { overview: next, error } = await fetchFiskalyProvisionOverview({
        checkRemote,
      });
      setProvisionLoading(false);
      if (error) {
        console.warn("fiskaly provision overview", error);
        return;
      }
      setOverview(next);
    },
    [enabled, credentialsConfigured],
  );

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, connection?.state, row.updated_at]);

  const locationNames = useMemo(() => {
    const map: Record<string, string> = {};
    for (const loc of overview?.locations ?? []) {
      map[loc.restaurantId] = loc.name;
    }
    return map;
  }, [overview?.locations]);

  const snapshot = useMemo(
    () =>
      JSON.stringify({
        enabled: row.enabled,
        env: ui.env ?? "TEST",
        signDeBaseUrl: ui.sign_de_base_url ?? DEFAULT_SIGN_DE_BASE_URL,
        eReceiptBaseUrl: ui.ereceipt_base_url ?? DEFAULT_ERECEIPT_BASE_URL,
      }),
    [row.enabled, ui.env, ui.sign_de_base_url, ui.ereceipt_base_url],
  );

  const dirty = useMemo(() => {
    const current = JSON.stringify({
      enabled,
      env,
      signDeBaseUrl: signDeBaseUrl.trim(),
      eReceiptBaseUrl: eReceiptBaseUrl.trim(),
    });
    return (
      current !== snapshot || apiKey.length > 0 || apiSecret.length > 0
    );
  }, [enabled, env, signDeBaseUrl, eReceiptBaseUrl, apiKey, apiSecret, snapshot]);

  useEffect(() => {
    setEnabled(row.enabled);
    setEnv(ui.env ?? "TEST");
    setSignDeBaseUrl(ui.sign_de_base_url ?? DEFAULT_SIGN_DE_BASE_URL);
    setEReceiptBaseUrl(ui.ereceipt_base_url ?? DEFAULT_ERECEIPT_BASE_URL);
    setApiKey("");
    setApiSecret("");
    // eslint-disable-next-line react-hooks/exhaustive-deps -- snapshot
  }, [snapshot]);

  const save = async () => {
    if (enabled && !credentialsConfigured && (!apiKey.trim() || !apiSecret.trim())) {
      toast.error("Fiskaly API-Key und API-Secret erforderlich.");
      return;
    }

    const config: Record<string, unknown> = {
      env,
      sign_de_base_url: signDeBaseUrl.trim() || DEFAULT_SIGN_DE_BASE_URL,
      ereceipt_base_url: eReceiptBaseUrl.trim() || DEFAULT_ERECEIPT_BASE_URL,
    };
    if (apiKey.trim()) config.api_key = apiKey.trim();
    if (apiSecret.trim()) config.api_secret = apiSecret.trim();

    const { ok, error } = await saveSuperadminPlatformIntegration(
      "fiskaly",
      enabled,
      config,
    );
    if (!ok) {
      toast.error(error ?? "Speichern fehlgeschlagen.");
      return;
    }
    toast.success("Fiskaly gespeichert.");
    setApiKey("");
    setApiSecret("");
    onSaved();
  };

  useRegisterSuperadminIntegrationSave("fiskaly", dirty, save);

  const secretsRequired = enabled && !credentialsConfigured;

  const runProvision = async (restaurantIds?: string[]) => {
    const singleId =
      restaurantIds?.length === 1 ? restaurantIds[0]! : null;
    if (singleId) setBusyRestaurantId(singleId);
    else setProvisioning(true);

    const { result, error } = await provisionFiskalyRestaurants(restaurantIds);

    if (singleId) setBusyRestaurantId(null);
    else setProvisioning(false);

    if (error || !result) {
      toast.error(error ?? "Provisionierung fehlgeschlagen.");
      return;
    }

    if (restaurantIds?.length === 1) {
      const one = result.results[0];
      if (one?.ok) toast.success(`${locationNames[one.restaurantId] ?? "Standort"}: Erfolg`);
      else toast.error(one?.errorLabel ?? "Provisionierung fehlgeschlagen.");
      setBulkResults(null);
    } else {
      setBulkResults(result.results);
      toast.success(
        `Fiskaly: ${result.ready} von ${result.total} Standorten bereit${result.failed ? `, ${result.failed} fehlgeschlagen` : ""}.`,
      );
    }

    await loadOverview(true);
    onSaved();
  };

  const openReconcile = async (location: FiskalyProvisionLocation) => {
    setReconcileOpen(true);
    setReconcilePreview(null);
    setReconcileLoading(true);
    const { preview, error } = await previewFiskalyReconcileRestaurant(
      location.restaurantId,
    );
    setReconcileLoading(false);
    if (error) {
      toast.error(error);
      setReconcileOpen(false);
      return;
    }
    setReconcilePreview(preview);
  };

  const confirmReconcile = async () => {
    if (!reconcilePreview?.match) return;
    setReconcileLoading(true);
    const { ok, error, outcomeLabel } = await confirmFiskalyReconcileRestaurant(
      reconcilePreview.restaurantId,
      reconcilePreview.match,
    );
    setReconcileLoading(false);
    if (!ok) {
      toast.error(error ?? "Verknüpfen fehlgeschlagen.");
      return;
    }
    toast.success(outcomeLabel ?? "Standort verknüpft.");
    setReconcileOpen(false);
    setReconcilePreview(null);
    await loadOverview(true);
    onSaved();
  };

  return (
    <SuperadminIntegrationPanel
      title="Fiskaly (TSE / KassenSichV)"
      description="Plattform-Zugang für SIGN DE und eReceipt. Nach Barzahlung in der Staff-App signiert der Server Bestellungen TSE-konform — Keys nur serverseitig, pro Restaurant zusätzlich TSS und Client."
      icon={<ShieldCheck className="size-5" aria-hidden />}
      badges={
        <SuperadminIntegrationStatusBadges
          enabled={enabled}
          configured={credentialsConfigured}
          configuredLabel="API-Zugang hinterlegt"
          connection={connection}
          connectionChecking={connectionChecking}
        />
      }
      headerTrailing={
        <Switch
          checked={enabled}
          onCheckedChange={(v) => setEnabled(v === true)}
          aria-label="Fiskaly aktivieren"
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label className={superadminIntegrationFieldLabelClassName}>
            Umgebung
          </Label>
          <Select
            value={env}
            onValueChange={(v) => setEnv(v === "LIVE" ? "LIVE" : "TEST")}
            disabled={!enabled}
          >
            <SelectTrigger
              className={appSelectTriggerAccentCn(
                "h-10 w-full min-w-[8rem] rounded-xl",
              )}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="TEST">TEST (Sandbox)</SelectItem>
              <SelectItem value="LIVE">LIVE (Produktion)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <SecretInput
        id="platform-fiskaly-api-key"
        label="Fiskaly API-Key"
        disabled={!enabled}
        configured={apiKeyConfigured}
        value={apiKey}
        onChange={setApiKey}
        placeholder={secretsRequired && !apiKeyConfigured ? "API-Key eingeben" : undefined}
        hint={
          apiKeyConfigured
            ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
            : undefined
        }
      />

      <SecretInput
        id="platform-fiskaly-api-secret"
        label="Fiskaly API-Secret"
        disabled={!enabled}
        configured={apiSecretConfigured}
        value={apiSecret}
        onChange={setApiSecret}
        placeholder={
          secretsRequired && !apiSecretConfigured ? "API-Secret eingeben" : undefined
        }
        hint={
          apiSecretConfigured
            ? "Punkte = gespeichertes Secret. Feld anklicken zum Ersetzen."
            : undefined
        }
      />

      <div className="space-y-2">
        <Label
          htmlFor="platform-fiskaly-sign-de-url"
          className={superadminIntegrationFieldLabelClassName}
        >
          SIGN DE Basis-URL
        </Label>
        <Input
          id="platform-fiskaly-sign-de-url"
          className={superadminIntegrationInputClassName}
          disabled={!enabled}
          value={signDeBaseUrl}
          onChange={(e) => setSignDeBaseUrl(e.target.value)}
          placeholder={DEFAULT_SIGN_DE_BASE_URL}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label
          htmlFor="platform-fiskaly-ereceipt-url"
          className={superadminIntegrationFieldLabelClassName}
        >
          eReceipt Basis-URL
        </Label>
        <Input
          id="platform-fiskaly-ereceipt-url"
          className={superadminIntegrationInputClassName}
          disabled={!enabled}
          value={eReceiptBaseUrl}
          onChange={(e) => setEReceiptBaseUrl(e.target.value)}
          placeholder={DEFAULT_ERECEIPT_BASE_URL}
          autoComplete="off"
        />
      </div>

      {enabled && credentialsConfigured && connection?.state === "ok" ? (
        <div className="rounded-xl border border-border/50 bg-muted/30 px-3 py-2.5 text-sm">
          <p className="font-medium">Standorte (TSS + Kasse)</p>
          {provisionLoading ? (
            <p className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="size-3.5 animate-spin" aria-hidden />
              Status wird geladen…
            </p>
          ) : overview ? (
            <>
              <p className="mt-1 text-xs text-muted-foreground">
                {overview.ready} bereit · {overview.pending} ausstehend
                {overview.failed > 0 ? ` · ${overview.failed} fehlgeschlagen` : ""}{" "}
                (gesamt {overview.totalRestaurants})
              </p>
              {overview.cashRegisterMissing > 0 ? (
                <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
                  {overview.cashRegisterMissing} Standort
                  {overview.cashRegisterMissing === 1 ? "" : "e"} ohne DSFinV-K
                  Cash Register.
                </p>
              ) : null}
              <FiskalyStandorteTable
                locations={overview.locations}
                busyRestaurantId={busyRestaurantId}
                onProvisionOne={(id) => void runProvision([id])}
                onRetry={(id) => void runProvision([id])}
                onReconcile={(loc) => void openReconcile(loc)}
              />
              {bulkResults ? (
                <FiskalyProvisionResultsPanel
                  results={bulkResults}
                  locationNames={locationNames}
                />
              ) : null}
            </>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-xl"
              disabled={provisioning || connectionChecking || provisionLoading}
              onClick={() => void runProvision()}
            >
              {provisioning ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                  Wird angelegt…
                </>
              ) : (
                "Alle Standorte anlegen"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl"
              disabled={provisionLoading}
              onClick={() => void loadOverview(true)}
            >
              Fiskaly-Abgleich prüfen
            </Button>
          </div>
        </div>
      ) : null}

      <FiskalyReconcileDialog
        open={reconcileOpen}
        onOpenChange={setReconcileOpen}
        preview={reconcilePreview}
        loading={reconcileLoading}
        onConfirm={() => void confirmReconcile()}
      />

      {enabled && connection?.state === "error" && connection.message ? (
        <div
          className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2.5 text-sm text-destructive dark:text-red-300"
          role="alert"
        >
          <p className="font-medium">Verbindung fehlgeschlagen</p>
          <p className="mt-1 text-xs opacity-90">{connection.message}</p>
          <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
            <li>API-Key und Secret aus dem fiskaly Dashboard → API Keys (nicht Login)</li>
            <li>TEST-Key bei Umgebung TEST, LIVE-Key bei LIVE</li>
            <li>Beide Felder neu eintragen, speichern, dann „Verbindungen prüfen“</li>
          </ul>
        </div>
      ) : null}
    </SuperadminIntegrationPanel>
  );
}
