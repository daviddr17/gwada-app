"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeMuted,
} from "@/components/settings/settings-integration-panel";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { cn } from "@/lib/utils";

type PaymentAccountStatus = {
  platformEnabled: boolean;
  platformConfigured: boolean;
  status: "connected" | "disconnected";
  displayName: string | null;
  connectedAt: string | null;
  message?: string;
};

export function PaymentAccountConnectCard({
  provider,
  title,
  description,
  icon,
  accentColor,
  permission,
  notReadyMessage,
  disconnectTitle,
  disconnectDescription,
  deniedMessage,
  noRestaurantMessage,
}: {
  provider: "mollie" | "adyen";
  title: string;
  description: string;
  icon: ReactNode;
  accentColor: string;
  permission: RestaurantPermissionKey;
  notReadyMessage: string;
  disconnectTitle: string;
  disconnectDescription: string;
  deniedMessage: string;
  noRestaurantMessage: string;
}) {
  const searchParams = useSearchParams();
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canConnect = has(permission);
  const [state, setState] = useState<PaymentAccountStatus | null>(null);
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const requestGen = useRef(0);
  const loading = Boolean(restaurantId) && fetchedFor !== restaurantId;

  const loadStatus = useCallback(async () => {
    if (!restaurantId) return;
    const gen = ++requestGen.current;
    const forRestaurantId = restaurantId;
    const disconnected: PaymentAccountStatus = {
      platformEnabled: false,
      platformConfigured: false,
      status: "disconnected",
      displayName: null,
      connectedAt: null,
      message: notReadyMessage,
    };
    try {
      const res = await fetch(
        `/api/integrations/${provider}/status?${new URLSearchParams({ restaurantId: forRestaurantId })}`,
      );
      const data = (await res.json()) as PaymentAccountStatus & { error?: string };
      if (requestGen.current !== gen) return;
      if (!res.ok) {
        if (res.status !== 403) {
          toast.error(data.error ?? `${title}: Status konnte nicht geladen werden.`);
        }
        setState(disconnected);
        setFetchedFor(forRestaurantId);
        return;
      }
      setState(data);
      setFetchedFor(forRestaurantId);
    } catch {
      if (requestGen.current !== gen) return;
      toast.error(`Netzwerkfehler (${title}).`);
      setState(disconnected);
      setFetchedFor(forRestaurantId);
    }
  }, [notReadyMessage, provider, restaurantId, title]);

  useEffect(() => {
    if (!restaurantId) return;
    let cancelled = false;
    void (async () => {
      await Promise.resolve();
      if (cancelled) return;
      await loadStatus();
    })();
    return () => {
      cancelled = true;
      requestGen.current += 1;
    };
  }, [loadStatus, restaurantId]);

  useEffect(() => {
    const result = searchParams.get(provider);
    const message = searchParams.get("message");
    if (!result) return;
    if (result === "connected") {
      toast.success(`${title} verbunden.`);
    } else if (result === "error") {
      toast.error(
        message
          ? decodeURIComponent(message.replace(/\+/g, " "))
          : `${title}: Verbindung fehlgeschlagen.`,
      );
    }
    const url = new URL(window.location.href);
    url.searchParams.delete(provider);
    if (message) url.searchParams.delete("message");
    window.history.replaceState({}, "", url.pathname + url.search);
  }, [provider, searchParams, title]);

  const connect = () => {
    if (!restaurantId) return;
    window.location.href = `/api/integrations/${provider}/connect?${new URLSearchParams({ restaurantId })}`;
  };

  const disconnect = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/integrations/${provider}/disconnect`, {
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

  const current = restaurantId && fetchedFor === restaurantId ? state : null;
  const connected = current?.status === "connected";
  const alert =
    !connected && current?.message
      ? current.message
      : !connected && current && !current.platformConfigured
        ? notReadyMessage
        : undefined;

  return (
    <>
      <SettingsIntegrationPanel
        title={title}
        description={description}
        icon={icon}
        accentColor={accentColor}
        defaultOpen
        badge={
          connected
            ? integrationStatusBadgeConnected()
            : integrationStatusBadgeMuted("Nicht verbunden")
        }
        summaryLine={connected && current?.displayName ? current.displayName : undefined}
        alertLine={alert}
        loading={permLoading || !workspaceReady || loading}
        denied={!permLoading && !canConnect}
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
              disabled={busy}
              onClick={connect}
            >
              Verbinden
            </Button>
          )}
        </div>
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
