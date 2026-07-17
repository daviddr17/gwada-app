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

type VoidReason = {
  id: string;
  name: string;
  restoreInventory: boolean;
  sortOrder: number;
  isActive: boolean;
};

export function PosVoidReasonsSettingsPanel() {
  const { restaurantId, ready } = useWorkspaceRestaurantUuid();
  const [reasons, setReasons] = useState<VoidReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [restoreInventory, setRestoreInventory] = useState(true);
  const [saving, setSaving] = useState(false);
  const showSkeleton = useDeferredSkeleton(!ready || loading);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/pos/void-reasons?restaurantId=${encodeURIComponent(restaurantId)}`,
        { cache: "no-store" },
      );
      const json = (await res.json()) as {
        reasons?: VoidReason[];
        error?: string;
      };
      if (!res.ok) toast.error(json.error ?? "Gründe laden fehlgeschlagen");
      else setReasons(json.reasons ?? []);
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
      const res = await fetch("/api/pos/void-reasons", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          name: name.trim(),
          restoreInventory,
        }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? "Speichern fehlgeschlagen");
        return;
      }
      toast.success("Storno-Grund angelegt");
      setName("");
      setRestoreInventory(true);
      void load();
    } finally {
      setSaving(false);
    }
  };

  const patch = async (
    reason: VoidReason,
    next: Partial<Pick<VoidReason, "name" | "restoreInventory">>,
  ) => {
    if (!restaurantId) return;
    const res = await fetch("/api/pos/void-reasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        id: reason.id,
        name: next.name ?? reason.name,
        restoreInventory: next.restoreInventory ?? reason.restoreInventory,
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
    if (reasons.length <= 1) {
      toast.error("Mindestens ein Storno-Grund nötig");
      return;
    }
    const res = await fetch("/api/pos/void-reasons", {
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
    if (next < 0 || next >= reasons.length) return;
    const ordered = [...reasons];
    const [item] = ordered.splice(index, 1);
    ordered.splice(next, 0, item!);
    setReasons(ordered);
    const res = await fetch("/api/pos/void-reasons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        restaurantId,
        reorder: true,
        orderedIds: ordered.map((r) => r.id),
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
        <CardTitle className="text-base font-semibold">Storno-Gründe</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">
          Beim Bar-Storno muss ein Grund gewählt werden. Pro Grund festlegen, ob
          gebuchter Bestand wieder erhöht wird.
        </p>

        <div className="space-y-3 rounded-xl border border-border/50 bg-muted/20 p-4">
          <div className="space-y-1.5">
            <Label htmlFor="void-reason-name">Name</Label>
            <Input
              id="void-reason-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="z. B. Küche abgelehnt"
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-background/60 px-3 py-2.5">
            <div>
              <p className="text-sm font-medium">Bestand zurückbuchen</p>
              <p className="text-xs text-muted-foreground">
                Zutaten wieder auf den Lagerbestand addieren
              </p>
            </div>
            <Switch
              checked={restoreInventory}
              onCheckedChange={(v) => setRestoreInventory(v === true)}
            />
          </div>
          <Button
            type="button"
            className={brandActionButtonRoundedClassName}
            onClick={() => void saveNew()}
            disabled={!name.trim() || saving}
          >
            <Plus className="size-4" />
            Grund anlegen
          </Button>
        </div>

        <ul className="divide-y divide-border/40">
          {reasons.map((r, index) => (
            <li
              key={r.id}
              className="flex items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1 space-y-2">
                <Input
                  defaultValue={r.name}
                  key={`${r.id}-${r.name}`}
                  className="h-9 max-w-xs"
                  onBlur={(e) => {
                    const next = e.target.value.trim();
                    if (!next) {
                      void load();
                      return;
                    }
                    if (next !== r.name) void patch(r, { name: next });
                  }}
                />
                <label className="flex items-center gap-2 text-sm">
                  <Switch
                    checked={r.restoreInventory}
                    onCheckedChange={(v) => {
                      const on = v === true;
                      setReasons((prev) =>
                        prev.map((x) =>
                          x.id === r.id ? { ...x, restoreInventory: on } : x,
                        ),
                      );
                      void patch(r, { restoreInventory: on });
                    }}
                  />
                  Bestand zurückbuchen
                </label>
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
                  disabled={index === reasons.length - 1}
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
                  onClick={() => void remove(r.id)}
                  aria-label="Löschen"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
