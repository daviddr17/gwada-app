"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeMuted,
} from "@/components/settings/settings-integration-panel";
import { IntegrationGrantedScopes } from "@/components/settings/integration-granted-scopes";
import { oauthScopeIdsForProvider } from "@/lib/constants/integration-oauth-scopes";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { OAuthIntegrationStatusResponse } from "@/lib/types/oauth-integration-response";
import { cn } from "@/lib/utils";

export function OAuthChannelIntegrationCard({
  provider,
  title,
  description,
  icon,
  permission,
  connectLabel = "Verbinden",
  disconnectTitle,
  disconnectDescription,
  noRestaurantMessage,
  deniedMessage,
  platformNotConfiguredHint,
}: {
  provider: "facebook" | "instagram" | "google_business";
  title: string;
  description: string;
  icon: React.ReactNode;
  permission: RestaurantPermissionKey;
  connectLabel?: string;
  disconnectTitle: string;
  disconnectDescription: string;
  noRestaurantMessage: string;
  deniedMessage: string;
  platformNotConfiguredHint: string;
}) {
  const searchParams = useSearchParams();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canConnect = has(permission);
  const [state, setState] = useState<OAuthIntegrationStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);

  const loadStatus = useCallback(async () => {
    if (!restaurantId) {
      setState(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/integrations/${provider === "google_business" ? "google-business" : provider}/status?${new URLSearchParams({ restaurantId })}`,
      );
      const data = (await res.json()) as OAuthIntegrationStatusResponse & {
        error?: string;
      };
      if (!res.ok) {
        if (res.status === 403) {
          setState({
            platformEnabled: false,
            platformConfigured: false,
            configured: false,
            status: "disconnected",
            displayName: null,
            accountId: null,
            secondaryLabel: null,
            connectedAt: null,
            requestedScopes: [],
            grantedScopes: [],
          });
          setLoading(false);
          return;
        }
        toast.error(data.error ?? `${title}: Status konnte nicht geladen werden.`);
        setLoading(false);
        return;
      }
      setState(data);
    } catch {
      toast.error(`Netzwerkfehler (${title}).`);
    }
    setLoading(false);
  }, [restaurantId, provider, title]);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  useEffect(() => {
    const result = searchParams.get(provider);
    const message = searchParams.get("message");
    if (!result) return;
    if (result === "connected") {
      toast.success(`${title} verbunden.`);
      void loadStatus();
    } else if (result === "error") {
      toast.error(
        message
          ? decodeURIComponent(message.replace(/\+/g, " "))
          : `${title}: Verbindung fehlgeschlagen.`,
      );
    }
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.delete(provider);
      if (message) url.searchParams.delete("message");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams, loadStatus, provider, title]);

  const connect = () => {
    if (!restaurantId) return;
    if (!state?.platformConfigured) {
      toast.error(platformNotConfiguredHint);
      return;
    }
    const path =
      provider === "google_business"
        ? "google-business"
        : provider;
    window.location.href = `/api/integrations/${path}/connect?${new URLSearchParams({ restaurantId })}`;
  };

  const disconnect = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const path =
        provider === "google_business"
          ? "google-business"
          : provider;
      const res = await fetch(`/api/integrations/${path}/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(data.error ?? "Trennen fehlgeschlagen.");
        return;
      }
      toast.success(`${title} getrennt.`);
      await loadStatus();
    } finally {
      setBusy(false);
      setConfirmDisconnectOpen(false);
    }
  };

  const platformFeatureEnabled = state?.platformEnabled !== false;
  const connected = state?.status === "working";
  const platformReady =
    platformFeatureEnabled && (state?.platformConfigured ?? false);
  const oauthParam = searchParams.get(provider);
  const plannedScopeIds = oauthScopeIdsForProvider(provider);
  const showScopesPreview = !connected;

  if (!loading && state && !platformFeatureEnabled) {
    return null;
  }

  const summaryParts: string[] = [];
  if (connected && state?.displayName) {
    summaryParts.push(state.displayName);
  }
  if (connected && state?.secondaryLabel) {
    summaryParts.push(state.secondaryLabel);
  }
  if (connected && state?.accountId) {
    summaryParts.push(`ID ${state.accountId}`);
  }

  return (
    <>
      <SettingsIntegrationPanel
        title={title}
        description={description}
        icon={icon}
        defaultOpen={oauthParam === "connected" || oauthParam === "error"}
        badge={
          connected
            ? integrationStatusBadgeConnected()
            : integrationStatusBadgeMuted("Nicht verbunden")
        }
        summaryLine={
          summaryParts.length > 0 ? summaryParts.join(" · ") : undefined
        }
        alertLine={undefined}
        loading={permLoading || !workspaceReady || loading}
        denied={!canConnect}
        deniedMessage={deniedMessage}
        noRestaurant={workspaceReady && !restaurantId}
        noRestaurantMessage={noRestaurantMessage}
      >
        <div className="flex flex-wrap gap-2">
          {connected ? (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={busy}
              onClick={() => setConfirmDisconnectOpen(true)}
            >
              Verbindung trennen
            </Button>
          ) : (
            <Button
              type="button"
              className={cn("h-11 rounded-xl", settingsAccentSaveButtonClassName)}
              disabled={busy || !platformReady}
              onClick={connect}
            >
              {connectLabel}
            </Button>
          )}
        </div>

        {showScopesPreview ? (
          <IntegrationGrantedScopes
            provider={provider}
            variant="preview"
            requestedScopes={plannedScopeIds}
            grantedScopes={[]}
          />
        ) : (
          <IntegrationGrantedScopes
            provider={provider}
            variant="active"
            requestedScopes={
              state?.requestedScopes?.length
                ? state.requestedScopes
                : plannedScopeIds
            }
            grantedScopes={state?.grantedScopes ?? []}
          />
        )}
      </SettingsIntegrationPanel>

      <ConfirmDialog
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        title={disconnectTitle}
        description={disconnectDescription}
        confirmLabel="Trennen"
        destructive
        onConfirm={() => void disconnect()}
      />
    </>
  );
}
