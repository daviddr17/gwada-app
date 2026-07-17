"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { cn } from "@/lib/utils";

type KdsStatus = {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
  printOnEnter: boolean;
  printerIds: string[];
  isActive: boolean;
};

type Printer = { id: string; name: string; isActive: boolean };

export function PosKdsStatusesSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [statuses, setStatuses] = useState<KdsStatus[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [printOnEnter, setPrintOnEnter] = useState(false);
  const [printerIds, setPrinterIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [stRes, prRes] = await Promise.all([
        fetch(
          `/api/pos/kds/statuses?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
        fetch(
          `/api/pos/printers?restaurantId=${encodeURIComponent(restaurantId)}`,
          { cache: "no-store" },
        ),
      ]);
      const stJson = (await stRes.json()) as {
        statuses?: KdsStatus[];
        error?: string;
      };
      const prJson = (await prRes.json()) as {
        printers?: Printer[];
        error?: string;
      };
      if (!stRes.ok) toast.error(stJson.error ?? "Status laden fehlgeschlagen");
      else setStatuses(stJson.statuses ?? []);
      if (prRes.ok) setPrinters((prJson.printers ?? []).filter((p) => p.isActive));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveNew = async () => {
    if (!restaurantId || !name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/pos/kds/statuses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: name.trim(),
          color,
          printOnEnter,
          printerIds,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Status angelegt");
      setName("");
      setColor("#3b82f6");
      setPrintOnEnter(false);
      setPrinterIds([]);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const patchStatus = async (
    status: KdsStatus,
    patch: Partial<
      Pick<KdsStatus, "name" | "color" | "printOnEnter" | "printerIds">
    >,
  ) => {
    if (!restaurantId) return;
    const res = await fetch("/api/pos/kds/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        id: status.id,
        name: patch.name ?? status.name,
        color: patch.color ?? status.color,
        printOnEnter: patch.printOnEnter ?? status.printOnEnter,
        printerIds: patch.printerIds ?? status.printerIds,
      }),
    });
    if (!res.ok) {
      toast.error("Aktualisieren fehlgeschlagen");
      return;
    }
    void load();
  };

  const remove = async (id: string) => {
    if (!restaurantId) return;
    if (statuses.length <= 1) {
      toast.error("Mindestens ein Status nötig");
      return;
    }
    const res = await fetch("/api/pos/kds/statuses", {
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

  const move = async (index: number, direction: -1 | 1) => {
    if (!restaurantId) return;
    const next = index + direction;
    if (next < 0 || next >= statuses.length) return;
    const ordered = [...statuses];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item!);
    setStatuses(ordered);
    const res = await fetch("/api/pos/kds/statuses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        reorder: true,
        orderedIds: ordered.map((s) => s.id),
      }),
    });
    if (!res.ok) {
      toast.error("Reihenfolge speichern fehlgeschlagen");
      void load();
    }
  };

  if (!ready || showSkeleton) {
    return <Skeleton className="mt-4 h-40 w-full rounded-xl" />;
  }

  return (
    <Card className="border-border/50 shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">KDS-Status</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Reihenfolge, Namen und Farben für die Küchenanzeige. Tippen auf ein
          Ticket wechselt zum nächsten Status. Optional: Bondruck beim
          Erreichen eines Status.
        </p>

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
            <div className="space-y-1.5">
              <Label htmlFor="kds-status-name">Name</Label>
              <Input
                id="kds-status-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z. B. Am Pass"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="kds-status-color">Farbe</Label>
              <div className="flex items-center gap-2">
                <input
                  id="kds-status-color"
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="size-10 cursor-pointer rounded-lg border border-border/50 bg-transparent p-1"
                />
                <Input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-10 w-[7.5rem] font-mono text-sm"
                />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Beim Status Bondruck</p>
              <p className="text-xs text-muted-foreground">
                Küchenzettel an Drucker senden, wenn Ticket diesen Status
                erreicht
              </p>
            </div>
            <Switch
              checked={printOnEnter}
              onCheckedChange={(v) => setPrintOnEnter(v === true)}
            />
          </div>
          {printOnEnter && printers.length > 0 ? (
            <div className="space-y-2">
              <Label>Drucker</Label>
              <div className="flex flex-wrap gap-2">
                {printers.map((p) => {
                  const on = printerIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs font-medium",
                        on
                          ? "border-accent/50 bg-accent/10 text-accent"
                          : "border-border/60 text-muted-foreground",
                      )}
                      onClick={() =>
                        setPrinterIds((prev) =>
                          on
                            ? prev.filter((x) => x !== p.id)
                            : [...prev, p.id],
                        )
                      }
                    >
                      {p.name}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Leer = alle aktiven Bondrucker
              </p>
            </div>
          ) : null}
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={() => void saveNew()}
            disabled={!name.trim() || saving}
          >
            <Plus className="size-4" />
            Status anlegen
          </Button>
        </div>

        <ul className="divide-y divide-border/40">
          {statuses.length === 0 ? (
            <li className="py-4 text-sm text-muted-foreground">
              Noch keine Status.
            </li>
          ) : (
            statuses.map((s, index) => (
              <li key={s.id} className="space-y-3 py-4">
                <div className="flex items-start gap-3">
                  <span
                    className="mt-2 size-4 shrink-0 rounded-full border border-border/40"
                    style={{ backgroundColor: s.color }}
                    aria-hidden
                  />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Input
                        defaultValue={s.name}
                        key={`${s.id}-${s.name}`}
                        onBlur={(e) => {
                          const next = e.target.value.trim();
                          if (!next) {
                            void load();
                            return;
                          }
                          if (next !== s.name) {
                            void patchStatus(s, { name: next });
                          }
                        }}
                        className="h-9 max-w-xs"
                      />
                      <input
                        type="color"
                        value={s.color}
                        onChange={(e) => {
                          const next = e.target.value;
                          setStatuses((prev) =>
                            prev.map((x) =>
                              x.id === s.id ? { ...x, color: next } : x,
                            ),
                          );
                          void patchStatus(s, { color: next });
                        }}
                        className="size-9 cursor-pointer rounded-lg border border-border/50 bg-transparent p-1"
                        aria-label={`Farbe ${s.name}`}
                      />
                      <span className="text-xs text-muted-foreground">
                        #{index + 1}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <Switch
                          checked={s.printOnEnter}
                          onCheckedChange={(v) => {
                            const on = v === true;
                            setStatuses((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? { ...x, printOnEnter: on }
                                  : x,
                              ),
                            );
                            void patchStatus(s, { printOnEnter: on });
                          }}
                        />
                        Bondruck
                      </label>
                      {s.printOnEnter && printers.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {printers.map((p) => {
                            const on = s.printerIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                className={cn(
                                  "rounded-full border px-2.5 py-0.5 text-[11px] font-medium",
                                  on
                                    ? "border-accent/50 bg-accent/10 text-accent"
                                    : "border-border/60 text-muted-foreground",
                                )}
                                onClick={() => {
                                  const next = on
                                    ? s.printerIds.filter((x) => x !== p.id)
                                    : [...s.printerIds, p.id];
                                  setStatuses((prev) =>
                                    prev.map((x) =>
                                      x.id === s.id
                                        ? { ...x, printerIds: next }
                                        : x,
                                    ),
                                  );
                                  void patchStatus(s, { printerIds: next });
                                }}
                              >
                                {p.name}
                              </button>
                            );
                          })}
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1">
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={index === 0}
                      onClick={() => void move(index, -1)}
                      aria-label="Nach oben"
                    >
                      <ArrowUp className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="rounded-full"
                      disabled={index === statuses.length - 1}
                      onClick={() => void move(index, 1)}
                      aria-label="Nach unten"
                    >
                      <ArrowDown className="size-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => void remove(s.id)}
                      aria-label="Löschen"
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </CardContent>
    </Card>
  );
}
