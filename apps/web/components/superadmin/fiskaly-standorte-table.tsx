"use client";

import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyToClipboardButton } from "@/components/ui/copy-to-clipboard-button";
import type { FiskalyProvisionLocation } from "@/lib/superadmin/fiskaly-provision-api";
import { cn } from "@/lib/utils";

function statusBadge(location: FiskalyProvisionLocation) {
  if (location.provisionStatus === "ready" && location.dsfinvkCashRegisterReady) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      >
        Bereit
      </Badge>
    );
  }
  if (location.provisionStatus === "ready" && !location.dsfinvkCashRegisterReady) {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-900 dark:text-amber-100">
        TSE OK · DSFinV-K fehlt
      </Badge>
    );
  }
  if (location.provisionStatus === "pending") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-900 dark:text-amber-100">
        Ausstehend
      </Badge>
    );
  }
  if (location.provisionStatus === "failed") {
    return <Badge variant="destructive">Fehlgeschlagen</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Nicht eingerichtet
    </Badge>
  );
}

function truncateId(id: string | null): string {
  if (!id) return "—";
  if (id.length <= 14) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}

export function FiskalyStandorteTable({
  locations,
  busyRestaurantId,
  onProvisionOne,
  onReconcile,
  onRetry,
}: {
  locations: FiskalyProvisionLocation[];
  busyRestaurantId?: string | null;
  onProvisionOne: (restaurantId: string) => void;
  onReconcile: (location: FiskalyProvisionLocation) => void;
  onRetry: (restaurantId: string) => void;
}) {
  if (!locations.length) {
    return (
      <p className="text-xs text-muted-foreground">Keine Restaurants vorhanden.</p>
    );
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-xl border border-border/50">
      <table className="w-full min-w-[640px] text-left text-xs">
        <thead className="border-b border-border/50 bg-muted/40 text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Standort</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Serien-Nr.</th>
            <th className="px-3 py-2 font-medium">TSS / Client</th>
            <th className="px-3 py-2 font-medium">Aktionen</th>
          </tr>
        </thead>
        <tbody>
          {locations.map((location) => {
            const busy = busyRestaurantId === location.restaurantId;
            const canRetry =
              location.provisionStatus === "failed" ||
              location.provisionStatus === "pending";
            const isReady =
              location.provisionStatus === "ready" && location.dsfinvkCashRegisterReady;

            return (
              <tr
                key={location.restaurantId}
                className="border-b border-border/40 align-top last:border-0"
              >
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{location.name}</p>
                  <p className="mt-0.5 text-muted-foreground">{location.locationLabel}</p>
                  {location.provisionErrorLabel ? (
                    <p
                      className={cn(
                        "mt-1.5 text-[11px] leading-snug",
                        location.suggestReconcile
                          ? "text-amber-800 dark:text-amber-200"
                          : "text-destructive dark:text-red-300",
                      )}
                    >
                      {location.provisionErrorLabel}
                    </p>
                  ) : null}
                  {location.fiskalyRemote ? (
                    <p className="mt-1 text-[11px] text-amber-800 dark:text-amber-200">
                      Bei Fiskaly vorhanden — Abgleich möglich
                    </p>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">{statusBadge(location)}</td>
                <td className="px-3 py-2.5">
                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <span className="break-all">
                      {location.clientSerial ?? location.expectedClientSerial}
                    </span>
                    <CopyToClipboardButton
                      value={location.clientSerial ?? location.expectedClientSerial}
                      label="Serien-Nr."
                    />
                  </div>
                </td>
                <td className="px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                  <div>TSS {truncateId(location.tssId)}</div>
                  <div>Client {truncateId(location.clientId)}</div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {!isReady ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg px-2 text-[11px]"
                        disabled={busy}
                        onClick={() => onProvisionOne(location.restaurantId)}
                      >
                        {busy ? (
                          <Loader2 className="size-3 animate-spin" aria-hidden />
                        ) : (
                          "Anlegen"
                        )}
                      </Button>
                    ) : null}
                    {canRetry ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 rounded-lg px-2 text-[11px]"
                        disabled={busy}
                        onClick={() => onRetry(location.restaurantId)}
                      >
                        Erneut
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="h-7 rounded-lg px-2 text-[11px]"
                      disabled={busy}
                      onClick={() => onReconcile(location)}
                    >
                      Abgleichen
                    </Button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
