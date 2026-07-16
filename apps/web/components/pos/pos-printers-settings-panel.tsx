"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import {
  POS_PRINTER_CONNECTION_LABELS_DE,
  POS_PRINTER_CONNECTION_TYPES,
  type PosPrinterConnectionType,
} from "@gwada/pos-domain";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";

type Printer = {
  id: string;
  name: string;
  connectionType: PosPrinterConnectionType;
  connectionConfig: Record<string, unknown>;
  isActive: boolean;
};

export function PosPrintersSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [connectionType, setConnectionType] =
    useState<PosPrinterConnectionType>("virtual");
  const [host, setHost] = useState("");
  const [port, setPort] = useState("9100");
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/printers?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        printers?: Printer[];
        error?: string;
      };
      if (!res.ok) toast.error(json.error ?? "Drucker laden fehlgeschlagen");
      else setPrinters(json.printers ?? []);
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!restaurantId || !name.trim()) return;
    const connectionConfig: Record<string, unknown> =
      connectionType === "network"
        ? {
            host: host.trim(),
            port: Number(port) || 9100,
          }
        : {};
    const res = await fetch("/api/pos/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        name: name.trim(),
        connectionType,
        connectionConfig,
      }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) {
      toast.error(data.error ?? "Speichern fehlgeschlagen");
      return;
    }
    toast.success("Drucker angelegt");
    setName("");
    setHost("");
    setPort("9100");
    setConnectionType("virtual");
    void load();
  };

  const remove = async (id: string) => {
    if (!restaurantId) return;
    const res = await fetch("/api/pos/printers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ restaurantId, id, delete: true }),
    });
    if (!res.ok) {
      toast.error("Löschen fehlgeschlagen");
      return;
    }
    void load();
  };

  if (!ready || showSkeleton) {
    return <Skeleton className="mt-4 h-40 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Bondrucker</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Küchen- und Bondrucker fürs Routing. Das iPad sendet ESC/POS
          direkt im LAN an feste IP:Port (meist 9100) — ohne Treiber,
          asynchron und ohne UI-Lag. „Virtuell“ = nur Queue zum Testen.
        </p>

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="printer-name">Name</Label>
            <Input
              id="printer-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Küche Hot, Bar"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Verbindung</Label>
            <Select
              value={connectionType}
              onValueChange={(v) =>
                setConnectionType(
                  (String(v ?? "virtual") as PosPrinterConnectionType) || "virtual",
                )
              }
            >
              <SelectTrigger
                className={appSelectTriggerAccentCn("h-9 w-full")}
              >
                <SelectValue>
                  {POS_PRINTER_CONNECTION_LABELS_DE[connectionType]}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {POS_PRINTER_CONNECTION_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {POS_PRINTER_CONNECTION_LABELS_DE[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {connectionType === "network" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="printer-host">Host / IP</Label>
                <Input
                  id="printer-host"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.50"
                  autoCapitalize="off"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="printer-port">Port</Label>
                <Input
                  id="printer-port"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  inputMode="numeric"
                />
              </div>
            </div>
          ) : null}
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={() => void save()}
            disabled={!name.trim()}
          >
            <Plus className="size-4" />
            Drucker anlegen
          </Button>
        </div>

        <ul className="divide-y divide-border/40">
          {printers.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">
              Noch keine Drucker — ohne Eintrag kann „Nur Drucker“ nicht
              geroutet werden.
            </li>
          ) : (
            printers.map((p) => (
              <li
                key={p.id}
                className="flex items-start justify-between gap-3 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {POS_PRINTER_CONNECTION_LABELS_DE[p.connectionType] ??
                      p.connectionType}
                    {p.connectionType === "network" &&
                    typeof p.connectionConfig.host === "string"
                      ? ` · ${p.connectionConfig.host}:${String(p.connectionConfig.port ?? 9100)}`
                      : null}
                  </p>
                </div>
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => void remove(p.id)}
                  aria-label="Löschen"
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
