"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { TripadvisorGlyph } from "@/components/icons/tripadvisor-glyph";
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
import { tripadvisorErrorMessageForUser } from "@/lib/integrations/tripadvisor-user-error-messages";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import type { TripadvisorIntegrationResponse } from "@/lib/types/restaurant-integration";

export function TripadvisorIntegrationCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.tripadvisor");
  const [state, setState] = useState<TripadvisorIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [locationId, setLocationId] = useState("");
  const [testing, setTesting] = useState(false);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const applyResponse = (data: TripadvisorIntegrationResponse) => {
    setState(data);
    setLocationId(data.locationId ?? "");
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
        `/api/integrations/tripadvisor?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as TripadvisorIntegrationResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "TripAdvisor-Verbindung konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      applyResponse(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden der TripAdvisor-Integration.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(() => {
    const saved = state?.locationId?.trim() ?? "";
    return locationId.trim() !== saved;
  }, [locationId, state?.locationId]);

  const save = useCallback(async () => {
    if (!restaurantId) return;
    const trimmed = locationId.trim();
    if (!trimmed) {
      toast.error("Location-ID erforderlich.");
      return;
    }

    const res = await fetch("/api/integrations/tripadvisor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        locationId: trimmed,
      }),
    });
    const data = (await res.json()) as TripadvisorIntegrationResponse & {
      error?: string;
    };
    if (!res.ok) {
      toast.error(data.error ?? "Verbindung fehlgeschlagen.");
      return;
    }
    toast.success("TripAdvisor verbunden.");
    applyResponse(data);
  }, [restaurantId, locationId]);

  useRegisterSettingsIntegrationSave("tripadvisor", dirty && canManage, save);

  const testConnection = async () => {
    if (!restaurantId) return;
    const trimmed = locationId.trim();
    if (!trimmed) {
      toast.error("Bitte zuerst eine Location-ID eingeben.");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch("/api/integrations/tripadvisor/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, locationId: trimmed }),
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
          : "Verbindung ok.",
      );
    } catch {
      toast.error("Netzwerkfehler beim Verbindungstest.");
    }
    setTesting(false);
  };

  const disconnect = async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/tripadvisor/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Trennen fehlgeschlagen.");
      throw new Error(data.error ?? "disconnect_failed");
    }
    toast.success("TripAdvisor getrennt.");
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
        title="TripAdvisor"
        description="Verknüpft euer TripAdvisor-Profil per Location-ID — Bewertungen und Fotos erscheinen in Gwada (nur lesen)."
        icon={<TripadvisorGlyph />}
        accentColor={INTEGRATION_PANEL_ACCENT.tripadvisor}
        badge={badge}
        summaryLine={
          connected && state?.locationName ? (
            <>
              Standort:{" "}
              <span className="font-medium text-foreground">{state.locationName}</span>
              {state.locationId ? (
                <span className="text-muted-foreground"> (ID {state.locationId})</span>
              ) : null}
            </>
          ) : state?.locationId ? (
            <>Location-ID hinterlegt — Verbindung prüfen und speichern.</>
          ) : undefined
        }
        alertLine={
          state?.lastError ? (
            <span className="text-destructive">
              {tripadvisorErrorMessageForUser(state.lastError)}
            </span>
          ) : !state?.platformEnabled ? (
            RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE
          ) : undefined
        }
        loading={permLoading || !workspaceReady || loading}
        denied={!canManage}
        deniedMessage="Deine Position hat keine Berechtigung, TripAdvisor zu verbinden. Bitte wende dich an eine Person mit Administrator-Rechten unter Einstellungen → Rollen."
        noRestaurant={workspaceReady && !restaurantId}
        noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um TripAdvisor zu verbinden."
      >
        <div className="space-y-2">
          <Label htmlFor="restaurant-tripadvisor-location-id">Location-ID</Label>
          <Input
            id="restaurant-tripadvisor-location-id"
            value={locationId}
            onChange={(e) => setLocationId(e.target.value)}
            placeholder="z. B. 1234567"
            inputMode="numeric"
            className="h-11 rounded-xl"
          />
          <p className="text-xs text-muted-foreground">
            Die numerische ID aus der TripAdvisor-URL eures Restaurants (…-d1234567-…).
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="h-11 rounded-xl"
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
      </SettingsIntegrationPanel>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="TripAdvisor trennen?"
        description="Die Location-ID und die Verknüpfung werden entfernt."
        confirmLabel="Trennen"
        destructive
        onConfirm={() => disconnect()}
      />
    </>
  );
}
