"use client";

import { useCallback, useEffect, useState } from "react";
import { CreditCard } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeMuted,
} from "@/components/settings/settings-integration-panel";
import { RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE } from "@/lib/constants/restaurant-integration-messages";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";

type MollieIntegrationResponse = {
  platformEnabled: boolean;
  configured: boolean;
  status: string;
  organizationName: string | null;
  connectUrl: string;
  lastError: string | null;
};

export function MollieIntegrationCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("integrations.mollie");
  const [state, setState] = useState<MollieIntegrationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnectOpen, setDisconnectOpen] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/mollie?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as MollieIntegrationResponse & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "Mollie-Verbindung konnte nicht geladen werden.");
        setLoading(false);
        return;
      }
      setState(data);
    } catch {
      toast.error("Netzwerkfehler beim Laden der Mollie-Integration.");
    }
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const disconnect = async () => {
    if (!restaurantId) return;
    const res = await fetch("/api/integrations/mollie/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId }),
    });
    if (!res.ok) {
      const data = (await res.json()) as { error?: string };
      toast.error(data.error ?? "Trennen fehlgeschlagen.");
      return;
    }
    toast.success("Mollie getrennt.");
    void load();
  };

  if (!workspaceReady || loading || permLoading) {
    return (
      <p className="text-sm text-muted-foreground" aria-busy>
        Mollie wird geladen…
      </p>
    );
  }

  if (!restaurantId) return null;

  if (!canManage) {
    return (
      <SettingsIntegrationPanel
        title="Mollie"
        description="Kartenzahlung und PayPal in der Kellner-App."
        icon={<CreditCard className="size-5" />}
        accentColor={INTEGRATION_PANEL_ACCENT.mollie}
        badges={integrationStatusBadgeMuted("Keine Berechtigung")}
      >
        <p className="text-sm text-muted-foreground">
          {RESTAURANT_INTEGRATION_NOT_ENABLED_MESSAGE}
        </p>
      </SettingsIntegrationPanel>
    );
  }

  const connected = Boolean(state?.configured);
  const badges = connected
    ? integrationStatusBadgeConnected(
        state?.organizationName ?? "Verbunden",
      )
    : integrationStatusBadgeMuted("Nicht verbunden");

  return (
    <>
      <SettingsIntegrationPanel
        title="Mollie"
        description="Kartenzahlung und PayPal für Staff-POS. Verbindung per OAuth mit eurem Mollie-Konto."
        icon={<CreditCard className="size-5" />}
        accentColor={INTEGRATION_PANEL_ACCENT.mollie}
        badges={badges}
      >
        {state?.lastError ? (
          <p className="text-sm text-destructive">{state.lastError}</p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              onClick={() => setDisconnectOpen(true)}
            >
              Verbindung trennen
            </Button>
          ) : (
            <Button type="button" asChild>
              <a href={state?.connectUrl ?? "#"}>Mit Mollie verbinden</a>
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Nach der Verbindung stehen in der Kellner-App „Karte“ und „PayPal“ neben
          Barzahlung zur Verfügung.
        </p>
      </SettingsIntegrationPanel>

      <ConfirmDialog
        open={disconnectOpen}
        onOpenChange={setDisconnectOpen}
        title="Mollie trennen?"
        description="Karten- und PayPal-Zahlungen in der Kellner-App sind danach nicht mehr möglich."
        confirmLabel="Trennen"
        onConfirm={() => void disconnect()}
      />
    </>
  );
}
