"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { LexofficeGlyph } from "@/components/icons/lexoffice-glyph";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SecretInput } from "@/components/ui/secret-input";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeMuted,
  integrationStatusBadgeWarning,
} from "@/components/settings/settings-integration-panel";
import { useRegisterSettingsIntegrationSave } from "@/components/settings/settings-integration-save-registry";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  lexofficeBusinessFeatureLabel,
  lexofficeTaxTypeLabel,
} from "@/lib/integrations/lexoffice-integration-config";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import type { LexofficeIntegrationResponse } from "@/lib/types/restaurant-integration";

export function LexofficeIntegrationCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.lexoffice");
  const [state, setState] = useState<LexofficeIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState("");
  const [disconnectOpen, setDisconnectOpen] = useState(false);
  const savedApiKeyRef = useRef("");

  const applyResponse = (data: LexofficeIntegrationResponse) => {
    setState(data);
    setApiKey("");
    savedApiKeyRef.current = "";
  };

  const load = useCallback(async () => {
    if (!restaurantId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/lexoffice?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as LexofficeIntegrationResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Lexware-Verbindung konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      applyResponse(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Lexware-Integration.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => apiKey.trim().length > 0, [apiKey]);

  const save = useCallback(async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/lexoffice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        apiKey,
      }),
    });
    const data = (await res.json()) as LexofficeIntegrationResponse & {
      error?: string;
    };
    if (!res.ok) {
      toast.error(data.error ?? "Verbindung fehlgeschlagen.");
      return;
    }
    toast.success("Lexware Office verbunden.");
    applyResponse(data);
  }, [restaurantId, apiKey]);

  useRegisterSettingsIntegrationSave("lexoffice", dirty && canManage, save);

  const disconnect = async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/lexoffice/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Trennen fehlgeschlagen.");
      throw new Error(data.error ?? "disconnect_failed");
    }
    toast.success("Lexware Office getrennt.");
    await load();
  };

  const connected = state?.status === "working";
  const apiKeyConfigured = state?.apiKeyConfigured ?? false;

  const badge = connected
    ? integrationStatusBadgeConnected()
    : state?.lastError
      ? integrationStatusBadgeWarning("Verbindung fehlgeschlagen")
      : integrationStatusBadgeMuted("Nicht verbunden");

  const taxLabel = lexofficeTaxTypeLabel(state?.taxType);
  const featureLabels = (state?.businessFeatures ?? []).map(
    lexofficeBusinessFeatureLabel,
  );

  return (
    <>
      <SettingsIntegrationPanel
        title="Lexware Office"
        description="Verbindet eure Lexware-Organisation per API-Key — für Buchhaltung und Rechnungen direkt aus Gwada (weitere Funktionen folgen)."
        icon={<LexofficeGlyph />}
        accentColor={INTEGRATION_PANEL_ACCENT.lexoffice}
        badge={badge}
        summaryLine={
          connected && state?.companyName ? (
            <>
              Organisation:{" "}
              <span className="font-medium text-foreground">{state.companyName}</span>
            </>
          ) : apiKeyConfigured ? (
            "API-Key hinterlegt — Verbindung prüfen und speichern."
          ) : undefined
        }
        alertLine={
          state?.lastError ? (
            <span className="text-destructive">{state.lastError}</span>
          ) : !state?.platformEnabled ? (
            RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE
          ) : undefined
        }
        loading={permLoading || !workspaceReady || loading}
        denied={!canManage}
        deniedMessage="Deine Position hat keine Berechtigung, Lexware Office zu verbinden. Bitte wende dich an eine Person mit Administrator-Rechten unter Einstellungen → Rollen."
        noRestaurant={workspaceReady && !restaurantId}
        noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um Lexware Office zu verbinden."
      >
        <SecretInput
          id="restaurant-lexoffice-key"
          label="Öffentlicher API-Key"
          configured={apiKeyConfigured}
          value={apiKey}
          onChange={setApiKey}
          placeholder={!apiKeyConfigured ? "API-Key aus Lexware einfügen" : undefined}
          hint={
            apiKeyConfigured
              ? "Punkte = gespeicherter Key. Feld anklicken zum Ersetzen."
              : "Erstellt unter Lexware → Einstellungen → Öffentliche API."
          }
        />

        {connected ? (
          <div className="space-y-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-3 text-sm">
            {state?.connectedUserName ? (
              <p>
                <span className="text-muted-foreground">Verbunden von:</span>{" "}
                {state.connectedUserName}
                {state.connectedUserEmail ? (
                  <span className="text-muted-foreground">
                    {" "}
                    ({state.connectedUserEmail})
                  </span>
                ) : null}
              </p>
            ) : null}
            {taxLabel ? (
              <p>
                <span className="text-muted-foreground">Steuerart:</span> {taxLabel}
              </p>
            ) : null}
            {featureLabels.length > 0 ? (
              <p>
                <span className="text-muted-foreground">Funktionen:</span>{" "}
                {featureLabels.join(", ")}
              </p>
            ) : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              onClick={() => setDisconnectOpen(true)}
            >
              Verbindung trennen
            </Button>
          ) : null}
        </div>

        {dirty ? (
          <p className="text-xs text-muted-foreground">
            Ungespeicherte Änderungen — unten auf „Speichern“ klicken.
          </p>
        ) : null}
      </SettingsIntegrationPanel>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Lexware Office trennen?"
        description="Der API-Key und die Verknüpfung zur Organisation werden entfernt."
        confirmLabel="Trennen"
        destructive
        onConfirm={() => disconnect()}
      />
    </>
  );
}
