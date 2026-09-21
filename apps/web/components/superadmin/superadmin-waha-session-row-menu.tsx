"use client";

import { useState } from "react";
import { MoreVertical, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
  WahaSessionAdminAction,
  WahaSessionListItem,
} from "@/lib/waha/waha-server-types";

type ConfirmKind = "logout" | "delete";

type Props = {
  session: WahaSessionListItem;
  busy?: boolean;
  onOpenDetails: () => void;
  onAction: (action: WahaSessionAdminAction) => void | Promise<void>;
};

function sessionLabel(session: WahaSessionListItem): string {
  return (
    session.restaurant_name?.trim() ||
    session.restaurant_slug ||
    session.waha_session_name
  );
}

export function SuperadminWahaSessionRowMenu({
  session,
  busy = false,
  onOpenDetails,
  onAction,
}: Props) {
  const [confirm, setConfirm] = useState<ConfirmKind | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button
                type="button"
                size="icon-sm"
                variant="outline"
                className="rounded-full"
                aria-label={`Aktionen für ${sessionLabel(session)}`}
                disabled={busy}
              />
            }
          >
            {busy ? (
              <RefreshCw className="size-3.5 animate-spin" />
            ) : (
              <MoreVertical className="size-3.5" />
            )}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-48 w-auto">
            <DropdownMenuItem onClick={onOpenDetails}>Details</DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onAction("refresh")}>
              Status synchronisieren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onAction("restart")}>
              Neu starten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onAction("start")}>
              Starten
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onAction("stop")}>
              Stoppen
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onAction("sync_webhooks")}>
              Webhooks aktualisieren
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => void onAction("heal")}>
              Session heilen
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirm("logout")}
            >
              Ausloggen
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              onClick={() => setConfirm("delete")}
            >
              Session löschen
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <ConfirmDialog
        open={confirm === "logout"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="WhatsApp ausloggen?"
        description={
          <>
            Trennt das Gerät von{" "}
            <span className="font-medium">{sessionLabel(session)}</span>. Das
            Restaurant muss danach erneut den QR-Code scannen.
          </>
        }
        confirmLabel="Ausloggen"
        destructive
        onConfirm={() => {
          setConfirm(null);
          void onAction("logout");
        }}
      />

      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => {
          if (!open) setConfirm(null);
        }}
        title="Session wirklich löschen?"
        description={
          <>
            Löscht die WAHA-Session von{" "}
            <span className="font-medium">{sessionLabel(session)}</span> inkl.
            Login-Daten auf dem Server. WhatsApp ist danach getrennt, der
            Eintrag verschwindet aus der Liste. Neu verbinden nur über QR-Code
            in den Restaurant-Einstellungen.
          </>
        }
        confirmLabel="Session löschen"
        destructive
        onConfirm={() => {
          setConfirm(null);
          void onAction("delete");
        }}
      />
    </>
  );
}
