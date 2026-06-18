"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  SettingsIntegrationPanel,
  integrationStatusBadgeConnected,
  integrationStatusBadgeMuted,
} from "@/components/settings/settings-integration-panel";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { invalidateInboxAfterChannelConnect } from "@/lib/contact-messages/invalidate-inbox-after-channel-connect-client";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import type { WahaConnectResponse } from "@/lib/types/restaurant-integration";
import { INTEGRATION_PANEL_ACCENT } from "@/lib/ui/integration-panel-accent";
import { cn } from "@/lib/utils";

const STATUS_LABEL: Record<string, string> = {
  disconnected: "Nicht verbunden",
  starting: "Wird gestartet…",
  scan_qr: "QR-Code scannen",
  working: "Verbunden",
  failed: "Fehler",
  stopped: "Gestoppt",
};

const QR_POLL_MS = 15_000;
const CONNECTED_POLL_MS = 45_000;

export function WhatsappIntegrationCard() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has, loading: permLoading } = useRestaurantPermissions();
  const canConnect = has("integrations.whatsapp");
  const [state, setState] = useState<WahaConnectResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [qrSrc, setQrSrc] = useState<string | null>(null);
  const [pairPhone, setPairPhone] = useState("");
  const [pairCode, setPairCode] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"qr" | "code">("qr");
  const [confirmDisconnectOpen, setConfirmDisconnectOpen] = useState(false);
  const [wasEverWorking, setWasEverWorking] = useState(false);
  const [liveCheckFailed, setLiveCheckFailed] = useState(false);
  const wasEverWorkingRef = useRef(false);
  const prevStatusRef = useRef<string | null>(null);

  const loadStatus = useCallback(
    async (refresh = false) => {
      if (!restaurantId) {
        setState(null);
        setLoading(false);
        return;
      }
      const q = new URLSearchParams({
        restaurantId,
        ...(refresh ? { refresh: "1" } : {}),
      });
      let res: Response;
      try {
        res = await fetch(`/api/integrations/waha/status?${q}`);
      } catch {
        if (refresh && wasEverWorkingRef.current) setLiveCheckFailed(true);
        setLoading(false);
        return;
      }
      const data = (await res.json()) as WahaConnectResponse & { error?: string };
      if (refresh && wasEverWorkingRef.current) {
        setLiveCheckFailed(!res.ok || data.status !== "working");
      } else if (res.ok) {
        setLiveCheckFailed(false);
      }
      if (data.status === "working") {
        wasEverWorkingRef.current = true;
        setWasEverWorking(true);
      }
      setState(data);
      setLoading(false);
    },
    [restaurantId],
  );

  const loadQr = useCallback(async () => {
    if (!restaurantId) return;
    const q = new URLSearchParams({ restaurantId });
    const res = await fetch(`/api/integrations/waha/qr?${q}`);
    if (!res.ok) {
      setQrSrc(null);
      return;
    }
    const data = (await res.json()) as { mimetype?: string; data?: string };
    if (data.data) {
      const mime = data.mimetype ?? "image/png";
      setQrSrc(`data:${mime};base64,${data.data}`);
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !state?.status) return;
    if (
      state.status === "working" &&
      prevStatusRef.current !== "working"
    ) {
      invalidateInboxAfterChannelConnect(restaurantId);
    }
    prevStatusRef.current = state.status;
  }, [restaurantId, state?.status]);

  useEffect(() => {
    void loadStatus(true);
  }, [loadStatus]);

  useEffect(() => {
    if (!restaurantId || state?.status !== "scan_qr") {
      setQrSrc(null);
      return;
    }
    void loadQr();
    const id = window.setInterval(() => {
      void loadQr();
      void loadStatus(true);
    }, QR_POLL_MS);
    return () => window.clearInterval(id);
  }, [restaurantId, state?.status, loadQr, loadStatus]);

  useEffect(() => {
    if (!restaurantId || state?.status !== "working" || liveCheckFailed) return;
    const id = window.setInterval(() => {
      void loadStatus(true);
    }, CONNECTED_POLL_MS);
    return () => window.clearInterval(id);
  }, [restaurantId, state?.status, liveCheckFailed, loadStatus]);

  const connect = async (restart = false) => {
    if (!restaurantId) return;
    setBusy(true);
    setPairCode(null);
    try {
      const res = await fetch("/api/integrations/waha/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, restart }),
      });
      const data = (await res.json()) as WahaConnectResponse & {
        error?: string;
        message?: string;
      };
      if (!res.ok) {
        toast.error(data.message ?? data.error ?? "Verbindung fehlgeschlagen");
        setState(data);
        return;
      }
      setState(data);
      if (!data.configured) {
        toast.error(
          "WhatsApp ist für euer Restaurant noch nicht freigeschaltet. Bitte wende dich an euren Gwada-Administrator.",
        );
        return;
      }
      if (data.status === "working") {
        toast.success("WhatsApp ist verbunden.");
      } else if (data.needsQr) {
        toast.message("QR-Code scannen oder Pairing-Code anfordern.");
        void loadQr();
      }
    } finally {
      setBusy(false);
    }
  };

  const requestCode = async () => {
    if (!restaurantId) return;
    const phone = pairPhone.replace(/\D/g, "");
    if (phone.length < 8) {
      toast.error("Bitte Telefonnummer mit Ländervorwahl eingeben (nur Ziffern).");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/waha/request-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, phoneNumber: phone }),
      });
      const data = (await res.json()) as { code?: string; error?: string };
      if (!res.ok || !data.code) {
        toast.error(data.error ?? "Pairing-Code konnte nicht angefordert werden.");
        return;
      }
      setPairCode(data.code);
      toast.success("Pairing-Code erstellt — in WhatsApp eingeben.");
      void loadStatus(true);
    } finally {
      setBusy(false);
    }
  };

  const disconnectConfirmed = async () => {
    if (!restaurantId) return;
    setBusy(true);
    try {
      const res = await fetch("/api/integrations/waha/disconnect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId }),
      });
      if (!res.ok) {
        toast.error("Trennen fehlgeschlagen.");
        return;
      }
      setQrSrc(null);
      setPairCode(null);
      wasEverWorkingRef.current = false;
      setWasEverWorking(false);
      setLiveCheckFailed(false);
      toast.success("WhatsApp getrennt.");
      await loadStatus();
    } finally {
      setBusy(false);
    }
  };

  const connected = state?.status === "working" && !liveCheckFailed;
  const needsAuth = state?.status === "scan_qr" || state?.status === "starting";
  const needsReconnect =
    state?.needsReconnect ||
    state?.status === "failed" ||
    state?.status === "stopped";
  const showNeuVerknuepfen =
    wasEverWorking &&
    !connected &&
    state?.configured &&
    (needsReconnect || liveCheckFailed || Boolean(state?.phoneNumber));

  const connectLabel = showNeuVerknuepfen
    ? "Neu verknüpfen"
    : needsReconnect
      ? "Erneut verbinden"
      : "Verbinden";
  const connectUsesRestart = showNeuVerknuepfen || needsReconnect;

  return (
    <>
      <SettingsIntegrationPanel
        title="WhatsApp"
        description="Verbinde die WhatsApp-Nummer eures Restaurants per QR-Code. Hier siehst du, ob die Nummer aktiv mit Gwada verbunden ist."
        icon={<WhatsAppGlyph />}
        accentColor={INTEGRATION_PANEL_ACCENT.whatsapp}
        badge={
          connected
            ? integrationStatusBadgeConnected()
            : integrationStatusBadgeMuted(
                STATUS_LABEL[state?.status ?? "disconnected"] ??
                  "Nicht verbunden",
              )
        }
        summaryLine={
          connected && state?.phoneNumber ? (
            <>
              {state.displayName ? `${state.displayName} · ` : null}
              <span className="font-mono">+{state.phoneNumber}</span>
            </>
          ) : undefined
        }
        alertLine={
          state && !state.configured
            ? "WhatsApp ist für euer Restaurant noch nicht freigeschaltet. Bitte wende dich an euren Gwada-Administrator."
            : undefined
        }
        loading={permLoading || !workspaceReady || loading}
        denied={!canConnect}
        deniedMessage="Deine Position hat keine Berechtigung, WhatsApp zu verbinden. Unter Einstellungen → Rollen kann ein Administrator das freischalten."
        noRestaurant={workspaceReady && !restaurantId}
        noRestaurantMessage="Wähle zuerst ein Restaurant im Workspace, um WhatsApp zu verbinden."
      >
        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <Button
              type="button"
              disabled={busy || !state?.configured}
              className={cn("h-11 rounded-xl", settingsAccentSaveButtonClassName)}
              onClick={() => void connect(connectUsesRestart)}
            >
              {busy ? "Bitte warten…" : connectLabel}
            </Button>
          ) : (
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl"
              disabled={busy}
              onClick={() => setConfirmDisconnectOpen(true)}
            >
              Trennen
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            className="h-11 rounded-xl"
            disabled={busy || !state?.configured}
            onClick={() => void loadStatus(true)}
          >
            Status prüfen
          </Button>
        </div>

        {(showNeuVerknuepfen || needsReconnect) && !needsAuth && state?.configured ? (
          <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
            {liveCheckFailed
              ? "Die Verbindung zu WhatsApp ist unterbrochen — bitte neu verknüpfen."
              : (state.message ??
                "WhatsApp ist nicht mehr aktiv — bitte neu verknüpfen (QR-Code oder Pairing-Code).")}
          </p>
        ) : null}

        {(needsAuth || (needsReconnect && state?.status === "failed")) &&
        state?.configured ? (
          <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-4">
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={authMode === "qr" ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setAuthMode("qr")}
              >
                QR-Code
              </Button>
              <Button
                type="button"
                size="sm"
                variant={authMode === "code" ? "default" : "outline"}
                className="rounded-lg"
                onClick={() => setAuthMode("code")}
              >
                Pairing-Code
              </Button>
            </div>

            {authMode === "qr" ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  WhatsApp → Verknüpfte Geräte → Gerät hinzufügen → QR-Code
                  scannen. Der Code erneuert sich alle 20–60 Sekunden.
                </p>
                {qrSrc ? (
                  <img
                    src={qrSrc}
                    alt="WhatsApp QR-Code"
                    className="mx-auto size-56 rounded-lg border border-border/50 bg-white p-2"
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    QR-Code wird geladen…
                  </p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Telefonnummer in internationaler Form (nur Ziffern, z. B.{" "}
                  <span className="font-mono">491701234567</span>), dann Code in
                  WhatsApp eingeben.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label htmlFor="wa-pair-phone">Telefonnummer</Label>
                    <Input
                      id="wa-pair-phone"
                      value={pairPhone}
                      onChange={(e) => setPairPhone(e.target.value)}
                      placeholder="491701234567"
                      inputMode="numeric"
                      className="h-11 rounded-xl font-mono"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-11 rounded-xl"
                    disabled={busy}
                    onClick={() => void requestCode()}
                  >
                    Code anfordern
                  </Button>
                </div>
                {pairCode ? (
                  <p className="rounded-lg border border-border/50 bg-background px-4 py-3 text-center font-mono text-2xl tracking-widest">
                    {pairCode}
                  </p>
                ) : null}
              </div>
            )}
          </div>
        ) : null}
      </SettingsIntegrationPanel>

      <ConfirmDialog
        open={confirmDisconnectOpen}
        onOpenChange={setConfirmDisconnectOpen}
        title="WhatsApp wirklich trennen?"
        description="Die WhatsApp-Verbindung wird beendet. Gäste können vorerst keine Nachrichten mehr über diese Nummer in Gwada empfangen oder senden."
        confirmLabel="Ja, wirklich trennen"
        cancelLabel="Abbrechen"
        confirmDisabled={busy}
        onConfirm={disconnectConfirmed}
      />
    </>
  );
}
