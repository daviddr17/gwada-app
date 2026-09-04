"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  Loader2,
  LogOut,
  Play,
  RefreshCw,
  RotateCcw,
  Square,
  Trash2,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";
import {
  WahaLiveSessionStatusBadge,
  WahaSessionStatusBadge,
} from "@/components/superadmin/waha-session-status-badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  fetchSuperadminWahaSessionDetail,
  runSuperadminWahaSessionAction,
} from "@/lib/superadmin/waha-servers-api";
import type {
  WahaSessionAdminAction,
  WahaSessionAdminDetail,
  WahaSessionListItem,
} from "@/lib/waha/waha-server-types";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type Props = {
  session: WahaSessionListItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged: () => void;
};

function formatDt(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

function DetailRow({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-3">
      <dt className="w-36 shrink-0 text-xs text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm">{children}</dd>
    </div>
  );
}

export function SuperadminWahaSessionDrawer({
  session,
  open,
  onOpenChange,
  onChanged,
}: Props) {
  const [detail, setDetail] = useState<WahaSessionAdminDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyAction, setBusyAction] = useState<WahaSessionAdminAction | null>(
    null,
  );
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading && !detail);

  const loadDetail = useCallback(async (restaurantId: string) => {
    setLoading(true);
    const res = await fetchSuperadminWahaSessionDetail(restaurantId);
    if (res.error) {
      toast.error(res.error);
      setDetail(null);
    } else {
      setDetail(res.detail ?? null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!open || !session) {
      setDetail(null);
      setBusyAction(null);
      return;
    }
    void loadDetail(session.restaurant_id);
  }, [open, session, loadDetail]);

  const runAction = async (action: WahaSessionAdminAction) => {
    if (!session) return;
    setBusyAction(action);
    const res = await runSuperadminWahaSessionAction(
      session.restaurant_id,
      action,
    );
    setBusyAction(null);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    toast.success(res.message ?? "OK");
    if (action === "delete") {
      onChanged();
      onOpenChange(false);
      return;
    }
    if (res.detail) setDetail(res.detail);
    onChanged();
  };

  const title =
    session?.restaurant_name?.trim() ||
    session?.restaurant_slug ||
    "WAHA-Session";

  const actionDisabled = busyAction !== null || loading;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="max-h-[92vh]">
          <DrawerHeader>
            <DrawerTitle>{title}</DrawerTitle>
            <DrawerDescription>
              Session steuern — Neustart, Start/Stop, Webhooks, Heilen. Status
              live von WAHA.
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 overflow-y-auto px-4 pb-2">
            {showSkeleton ? (
              <div className="space-y-3" aria-busy>
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : (
              <>
                <dl className="space-y-2.5 rounded-xl border border-border/50 bg-muted/15 px-3 py-3">
                  <DetailRow label="Session">
                    <span className="font-mono text-xs break-all">
                      {detail?.sessionName ?? session?.waha_session_name ?? "—"}
                    </span>
                  </DetailRow>
                  <DetailRow label="Server">
                    {session?.waha_server_name ?? "—"}
                  </DetailRow>
                  <DetailRow label="DB-Status">
                    <WahaSessionStatusBadge
                      status={detail?.dbStatus ?? session?.status}
                    />
                  </DetailRow>
                  <DetailRow label="Live (WAHA)">
                    {detail?.live.ok ? (
                      <WahaLiveSessionStatusBadge status={detail.live.status} />
                    ) : (
                      <span className="text-muted-foreground">
                        {detail?.live.error ?? "—"}
                      </span>
                    )}
                  </DetailRow>
                  <DetailRow label="Nummer">
                    {detail?.live.phoneNumber ??
                      detail?.phoneNumber ??
                      session?.phone_number ??
                      "—"}
                  </DetailRow>
                  <DetailRow label="Anzeigename">
                    {detail?.live.displayName ??
                      detail?.displayName ??
                      session?.display_name ??
                      "—"}
                  </DetailRow>
                  <DetailRow label="Verbunden">
                    {formatDt(detail?.connectedAt ?? session?.connected_at)}
                  </DetailRow>
                  <DetailRow label="Aktualisiert">
                    {formatDt(detail?.updatedAt ?? session?.updated_at)}
                  </DetailRow>
                  {(detail?.lastError || session?.last_error) && (
                    <DetailRow label="Letzter Fehler">
                      <span className="text-destructive break-words">
                        {detail?.lastError ?? session?.last_error}
                      </span>
                    </DetailRow>
                  )}
                </dl>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionDisabled}
                    onClick={() => void runAction("refresh")}
                  >
                    {busyAction === "refresh" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Sync Status
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionDisabled}
                    onClick={() => void runAction("restart")}
                  >
                    {busyAction === "restart" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RotateCcw className="size-3.5" />
                    )}
                    Neustart
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionDisabled}
                    onClick={() => void runAction("start")}
                  >
                    {busyAction === "start" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Play className="size-3.5" />
                    )}
                    Start
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionDisabled}
                    onClick={() => void runAction("stop")}
                  >
                    {busyAction === "stop" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <Square className="size-3.5" />
                    )}
                    Stop
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={actionDisabled}
                    onClick={() => void runAction("sync_webhooks")}
                  >
                    {busyAction === "sync_webhooks" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="size-3.5" />
                    )}
                    Webhooks
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-destructive"
                    disabled={actionDisabled}
                    onClick={() => setLogoutConfirmOpen(true)}
                  >
                    {busyAction === "logout" ? (
                      <Loader2 className="size-3.5 animate-spin" />
                    ) : (
                      <LogOut className="size-3.5" />
                    )}
                    Logout
                  </Button>
                </div>

                <Button
                  type="button"
                  size="lg"
                  className={cn(
                    brandActionButtonRoundedClassName,
                    "w-full",
                  )}
                  disabled={actionDisabled}
                  onClick={() => void runAction("heal")}
                >
                  {busyAction === "heal" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Wrench className="size-4" />
                  )}
                  Session heilen
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full text-destructive"
                  disabled={actionDisabled}
                  onClick={() => setDeleteConfirmOpen(true)}
                >
                  {busyAction === "delete" ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Trash2 className="size-4" />
                  )}
                  Session löschen
                </Button>
              </>
            )}
          </div>

          <DrawerFooter className="gap-2 sm:flex-row">
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
            >
              Schließen
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={logoutConfirmOpen}
        onOpenChange={setLogoutConfirmOpen}
        title="WhatsApp ausloggen?"
        description="Trennt das Gerät von dieser Session. Das Restaurant muss danach erneut den QR-Code scannen."
        confirmLabel="Ausloggen"
        destructive
        onConfirm={() => {
          setLogoutConfirmOpen(false);
          void runAction("logout");
        }}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title="Session wirklich löschen?"
        description="Löscht die WAHA-Session inkl. Login-Daten auf dem Server. WhatsApp ist danach getrennt, der Eintrag verschwindet aus der Liste. Neu verbinden nur über QR-Code in den Restaurant-Einstellungen."
        confirmLabel="Session löschen"
        destructive
        onConfirm={() => {
          setDeleteConfirmOpen(false);
          void runAction("delete");
        }}
      />
    </>
  );
}
