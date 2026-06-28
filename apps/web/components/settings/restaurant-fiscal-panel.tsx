"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CopyToClipboardButton } from "@/components/ui/copy-to-clipboard-button";
import { Label } from "@/components/ui/label";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { Input } from "@/components/ui/input";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { germanFiskalyProvisionError } from "@/lib/pos/fiskaly-error-messages";
import type { RestaurantFiscalOverview } from "@/lib/pos/restaurant-fiscal-overview-types";
import { cn } from "@/lib/utils";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";
import { RestaurantFiscalPanelSkeleton } from "@/components/settings/restaurant-fiscal-panel-skeleton";

function provisionStatusBadge(overview: RestaurantFiscalOverview) {
  if (!overview.platformEnabled) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        Plattform nicht aktiv
      </Badge>
    );
  }
  if (overview.provisionStatus === "ready" && overview.fiskalyEnabled) {
    return (
      <Badge
        variant="outline"
        className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
      >
        TSE aktiv
      </Badge>
    );
  }
  if (overview.provisionStatus === "pending") {
    return (
      <Badge variant="outline" className="border-amber-500/40 text-amber-900 dark:text-amber-100">
        Wird eingerichtet
      </Badge>
    );
  }
  if (overview.provisionStatus === "failed") {
    return <Badge variant="destructive">Einrichtung fehlgeschlagen</Badge>;
  }
  return (
    <Badge variant="outline" className="text-muted-foreground">
      Noch nicht eingerichtet
    </Badge>
  );
}

function ReadOnlyValue({
  label,
  value,
  mono = false,
  copyLabel,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  copyLabel?: string;
}) {
  const display = value?.trim() || "—";
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="flex items-start gap-1 rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5">
        <span
          className={cn(
            "min-w-0 flex-1 break-all text-sm text-foreground",
            mono && "font-mono text-xs leading-relaxed",
          )}
        >
          {display}
        </span>
        {value?.trim() ? (
          <CopyToClipboardButton
            value={value.trim()}
            label={copyLabel ?? label}
          />
        ) : null}
      </div>
    </div>
  );
}

function formatSignedAt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("de-DE", {
    dateStyle: "short",
    timeStyle: "medium",
  });
}

function parseEuroInputToCents(value: string): number | null {
  const normalized = value.trim().replace(",", ".");
  if (!normalized) return null;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return null;
  return Math.round(num * 100);
}

export function RestaurantFiscalPanel() {
  const { restaurantId, ready: workspaceReady } = useWorkspaceRestaurantUuid();
  const { has: hasPermission } = useRestaurantPermissions();
  const canManageKasse = hasPermission("pos.kasse.manage");
  const [overview, setOverview] = useState<RestaurantFiscalOverview | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [registerAction, setRegisterAction] = useState<"open" | "close" | null>(
    null,
  );
  const [openingCashEuro, setOpeningCashEuro] = useState("");
  const [closingCashEuro, setClosingCashEuro] = useState("");
  const showSkeleton = useDeferredSkeleton(!workspaceReady || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setOverview(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/fiscal-overview?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const data = (await res.json()) as RestaurantFiscalOverview & {
        error?: string;
      };
      if (!res.ok) {
        toast.error(data.error ?? "TSE-Daten konnten nicht geladen werden.");
        setOverview(null);
        return;
      }
      setOverview(data);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRegisterOpen = async () => {
    if (!restaurantId || !canManageKasse) return;
    const openingCashCents = parseEuroInputToCents(openingCashEuro);
    if (openingCashCents == null) {
      toast.error("Bitte einen gültigen Anfangsbestand eingeben.");
      return;
    }
    setRegisterAction("open");
    try {
      const res = await fetch(
        `/api/pos/fiskaly/register/open?restaurantId=${encodeURIComponent(restaurantId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ openingCashCents }),
        },
      );
      const data = (await res.json()) as { error?: string; openedAt?: string };
      if (!res.ok) {
        toast.error(
          data.error === "register_already_open"
            ? "Die Kasse ist bereits geöffnet."
            : (data.error ?? "Kasse konnte nicht geöffnet werden."),
        );
        return;
      }
      toast.success("Kasse geöffnet.");
      setOpeningCashEuro("");
      await load();
    } finally {
      setRegisterAction(null);
    }
  };

  const handleRegisterClose = async () => {
    if (!restaurantId || !canManageKasse) return;
    const closingCashCents = parseEuroInputToCents(closingCashEuro);
    if (closingCashCents == null) {
      toast.error("Bitte einen gültigen Endbestand eingeben.");
      return;
    }
    setRegisterAction("close");
    try {
      const res = await fetch(
        `/api/pos/fiskaly/register/close?restaurantId=${encodeURIComponent(restaurantId)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ closingCashCents }),
        },
      );
      const data = (await res.json()) as {
        error?: string;
        zNr?: number;
      };
      if (!res.ok) {
        toast.error(
          data.error === "register_not_open"
            ? "Die Kasse ist nicht geöffnet."
            : data.error === "no_signed_transactions_in_session"
              ? "Keine signierten Belege in dieser Kassensitzung."
              : (data.error ?? "Kassenabschluss fehlgeschlagen."),
        );
        return;
      }
      toast.success(
        data.zNr != null
          ? `Kasse geschlossen (Z${data.zNr}).`
          : "Kasse geschlossen.",
      );
      setClosingCashEuro("");
      await load();
    } finally {
      setRegisterAction(null);
    }
  };

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  if (showSkeleton) {
    return <RestaurantFiscalPanelSkeleton />;
  }

  if (!overview) {
    return (
      <p className="text-sm text-muted-foreground">
        TSE-Übersicht konnte nicht geladen werden.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/50 shadow-card">
        <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0 pb-3">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/30">
              <ShieldCheck className="size-5 text-muted-foreground" aria-hidden />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                Fiskaly TSE (dieser Standort)
              </CardTitle>
              <p className="mt-1 text-sm text-muted-foreground">
                Technische KassenSichV-Daten und zuletzt signierte Belege —
                nur Ansicht, Änderungen über Superadmin bzw. automatische
                Einrichtung.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {provisionStatusBadge(overview)}
            {overview.dsfinvkCashRegisterReady ? (
              <Badge
                variant="outline"
                className="border-emerald-500/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
              >
                Cash Register (DSFinV-K)
              </Badge>
            ) : overview.provisionStatus === "ready" ? (
              <Badge variant="outline" className="border-amber-500/40 text-amber-900 dark:text-amber-100">
                Cash Register fehlt
              </Badge>
            ) : null}
            {overview.registerOpenedAt ? (
              <Badge variant="secondary" className="text-xs">
                Kasse offen
              </Badge>
            ) : overview.dsfinvkCashRegisterReady ? (
              <Badge variant="outline" className="text-xs text-muted-foreground">
                Kasse geschlossen
              </Badge>
            ) : null}
            {overview.platformEnv ? (
              <Badge variant="secondary" className="text-xs">
                {overview.platformEnv}
              </Badge>
            ) : null}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {overview.provisionError ? (
            <p
              className="rounded-xl border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive dark:text-red-300"
              role="alert"
            >
              {germanFiskalyProvisionError(overview.provisionError)}
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <ReadOnlyValue label="TSS-ID" value={overview.tssId} mono />
            <ReadOnlyValue label="Client-ID (Kasse)" value={overview.clientId} mono />
            <ReadOnlyValue
              label="Kassen-Seriennummer"
              value={overview.clientSerial}
              mono
            />
            <ReadOnlyValue
              label="Eingerichtet am"
              value={
                overview.provisionedAt
                  ? formatSignedAt(overview.provisionedAt)
                  : null
              }
            />
            <ReadOnlyValue
              label="Kasse geöffnet seit"
              value={
                overview.registerOpenedAt
                  ? formatSignedAt(overview.registerOpenedAt)
                  : null
              }
            />
            <ReadOnlyValue
              label="Letzter Z-Bon"
              value={
                overview.lastClosingZNr != null
                  ? `Z${overview.lastClosingZNr}${overview.lastClosingAt ? ` · ${formatSignedAt(overview.lastClosingAt)}` : ""}`
                  : null
              }
            />
          </div>

          {overview.dsfinvkCashRegisterReady && canManageKasse ? (
            <div className="space-y-3 border-t border-border/40 pt-4">
              {!overview.registerOpenedAt ? (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Anfangsbestand (EUR)
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={openingCashEuro}
                    onChange={(e) => setOpeningCashEuro(e.target.value)}
                    className="max-w-xs rounded-xl"
                  />
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-muted-foreground">
                    Endbestand gezählt (EUR)
                  </Label>
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={closingCashEuro}
                    onChange={(e) => setClosingCashEuro(e.target.value)}
                    className="max-w-xs rounded-xl"
                  />
                </div>
              )}
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={
                    Boolean(overview.registerOpenedAt) || registerAction !== null
                  }
                  onClick={() => void handleRegisterOpen()}
                >
                  {registerAction === "open" ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                      Öffnet…
                    </>
                  ) : (
                    "Kasse öffnen"
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-xl"
                  disabled={
                    !overview.registerOpenedAt || registerAction !== null
                  }
                  onClick={() => void handleRegisterClose()}
                >
                  {registerAction === "close" ? (
                    <>
                      <Loader2 className="mr-1.5 size-4 animate-spin" aria-hidden />
                      Schließt…
                    </>
                  ) : (
                    "Kasse schließen (Z-Bon)"
                  )}
                </Button>
              </div>
            </div>
          ) : overview.dsfinvkCashRegisterReady && !canManageKasse ? (
            <p className="border-t border-border/40 pt-4 text-sm text-muted-foreground">
              Kasse öffnen/schließen erfordert die Berechtigung „Kasse öffnen und schließen“.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">
            Signierte Belege
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            {overview.recentSignatures.length > 0
              ? `${overview.recentSignatures.length} letzte TSE-Signaturen an diesem Standort`
              : "Noch keine TSE-signierten Zahlungen — nach Barzahlung in der Staff-App erscheinen Einträge hier."}
          </p>
        </CardHeader>
        <CardContent className="p-0 sm:px-6 sm:pb-6">
          {overview.recentSignatures.length === 0 ? null : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-sm">
                <thead>
                  <tr className={moduleDataTableHeadRowMutedClassName}>
                    <th className="px-4 py-2 sm:px-0">Bestellung</th>
                    <th className="px-4 py-2">Signiert</th>
                    <th className="px-4 py-2">Zähler</th>
                    <th className="px-4 py-2">Transaktions-ID</th>
                    <th className="px-4 py-2">Signatur</th>
                    <th className="px-4 py-2">Beleg</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.recentSignatures.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-border/40 last:border-0"
                    >
                      <td className="px-4 py-3 font-medium sm:px-0">
                        {row.orderNumber != null
                          ? `#${row.orderNumber}`
                          : row.orderId.slice(0, 8)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {formatSignedAt(row.signedAt)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {row.signatureCounter}
                      </td>
                      <td className="max-w-[10rem] px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="truncate font-mono text-xs">
                            {row.txId}
                          </span>
                          <CopyToClipboardButton
                            value={row.txId}
                            label="Transaktions-ID"
                          />
                        </div>
                      </td>
                      <td className="max-w-[14rem] px-4 py-3">
                        <div className="flex items-start gap-1">
                          <span className="line-clamp-2 font-mono text-xs leading-relaxed">
                            {row.signature}
                          </span>
                          <CopyToClipboardButton
                            value={row.signature}
                            label="TSE-Signatur"
                          />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {row.receiptPublicUrl ? (
                          <a
                            href={row.receiptPublicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            Öffnen
                            <ExternalLink className="size-3" aria-hidden />
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
