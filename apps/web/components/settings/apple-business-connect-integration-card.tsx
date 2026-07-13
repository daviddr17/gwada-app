"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { AppleGlyph } from "@/components/icons/apple-glyph";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { integrationPlatformSyncButtonClassName } from "@/lib/ui/integration-platform-sync-button";
import type { AppleBusinessConnectIntegrationResponse } from "@/lib/types/restaurant-integration";

export function AppleBusinessConnectIntegrationCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.apple_business_connect");
  const [state, setState] = useState<AppleBusinessConnectIntegrationResponse | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState("");
  const [brandId, setBrandId] = useState("");
  const [testing, setTesting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const applyResponse = (data: AppleBusinessConnectIntegrationResponse) => {
    setState(data);
    setLocationId(data.locationId ?? "");
    setBrandId(data.brandId ?? "");
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
        `/api/integrations/apple-business-connect?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as AppleBusinessConnectIntegrationResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(
          data.error ?? "Apple Business Connect konnte nicht geladen werden.",
        );
        setLoading(false);
        return;
      }
      applyResponse(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Apple-Integration.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const savedLocation = state?.locationId?.trim() ?? "";
    const savedBrand = state?.brandId?.trim() ?? "";
    return (
      locationId.trim() !== savedLocation || brandId.trim() !== savedBrand
    );
  }, [locationId, brandId, state?.locationId, state?.brandId]);

  const save = useCallback(async () => {
    if (!restaurantId) return;
    const trimmedLocation = locationId.trim();
    if (!trimmedLocation) {
      toast.error("Location-ID erforderlich.");
      return;
    }

    const res = await fetch("/api/integrations/apple-business-connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        locationId: trimmedLocation,
        brandId: brandId.trim() || null,
      }),
    });
    const data = (await res.json()) as AppleBusinessConnectIntegrationResponse & {
      error?: string;
    };
    if (!res.ok) {
      toast.error(data.error ?? "Verbindung fehlgeschlagen.");
      return;
    }
    toast.success("Apple Business Connect verbunden.");
    applyResponse(data);
  }, [restaurantId, locationId, brandId]);

  useRegisterSettingsIntegrationSave("apple_business_connect", dirty && canManage, save);

  const testConnection = async () => {
    if (!restaurantId) return;
    const trimmed = locationId.trim();
    if (!trimmed) {
      toast.error("Bitte zuerst eine Location-ID eingeben.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/apple-business-connect/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          locationId: trimmed,
          brandId: brandId.trim() || null,
        }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        locationName?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        toast.error(data.error ?? "Verbindungstest fehlgeschlagen.");
        return;
      }
      toast.success(
        data.locationName
          ? `Verbindung ok — ${data.locationName}`
          : "Verbindungstest erfolgreich.",
      );
    } catch {
      toast.error("Verbindungstest fehlgeschlagen.");
    } finally {
      setTesting(false);
    }
  };

  const disconnect = async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/apple-business-connect/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Trennen fehlgeschlagen.");
      throw new Error(data.error ?? "disconnect_failed");
    }
    toast.success("Apple Business Connect getrennt.");
    await load();
  };

  const connected = state?.status === "working";

  const badge = connected
    ? integrationStatusBadgeConnected()
    : state?.lastError
      ? integrationStatusBadgeWarning("Verbindung fehlgeschlagen")
      : integrationStatusBadgeMuted("Nicht verbunden");

  return (
    <>
      <SettingsIntegrationPanel
        title="Apple Business Connect"
        description="Standort in Apple Maps verwalten — Location-ID aus dem Apple Business Connect Dashboard. Sync-Aktionen (Standort, Actions, Showcases) werden vorbereitet."
        icon={<AppleGlyph className="text-foreground" />}
        accentColor={INTEGRATION_PANEL_ACCENT.apple_business_connect}
        badge={badge}
        summaryLine={
          connected && state?.locationName ? (
            <>
              Standort:{" "}
              <span className="font-medium text-foreground">{state.locationName}</span>
            </>
          ) : locationId.trim() ? (
            <>Location-ID hinterlegt — Verbindung prüfen und speichern.</>
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
        deniedMessage="Deine Position hat keine Berechtigung, Apple Business Connect zu verbinden."
        noRestaurant={workspaceReady && !restaurantId}
        noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace."
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="apple-bc-location-id">Location-ID</Label>
            <Input
              id="apple-bc-location-id"
              value={locationId}
              disabled={!canManage}
              onChange={(e) => setLocationId(e.target.value)}
              placeholder="z. B. LOC-…"
              className="h-11 rounded-xl font-mono text-sm"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="apple-bc-brand-id">Brand-ID (optional)</Label>
            <Input
              id="apple-bc-brand-id"
              value={brandId}
              disabled={!canManage}
              onChange={(e) => setBrandId(e.target.value)}
              placeholder="z. B. BRAND-…"
              className="h-11 rounded-xl font-mono text-sm"
              spellCheck={false}
            />
          </div>

          <div className="rounded-xl border border-dashed border-border/60 bg-muted/15 px-4 py-3">
            <p className="text-xs font-medium text-muted-foreground">
              Geplante Sync-Aktionen
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              <li>Standortdaten synchronisieren</li>
              <li>Reservierungs-Action (Showcase) übertragen</li>
              <li>Öffnungszeiten und Fotos abgleichen</li>
            </ul>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className={integrationPlatformSyncButtonClassName}
              disabled={testing || !locationId.trim()}
              onClick={() => void testConnection()}
            >
              {testing ? "Prüfe…" : "Verbindung testen"}
            </Button>
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
        </div>
      </SettingsIntegrationPanel>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Apple Business Connect trennen?"
        description="Die Location-ID wird entfernt. Apple Maps zeigt weiterhin euren bisherigen Standort."
        confirmLabel="Trennen"
        destructive
        onConfirm={() => disconnect()}
      />
    </>
  );
}
