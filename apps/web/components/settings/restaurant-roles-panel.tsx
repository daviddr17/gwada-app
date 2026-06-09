"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { settingsAccentSaveButtonClassName } from "@/components/settings/settings-sticky-save-bar";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  RESTAURANT_PERMISSION_CATALOG,
  type RestaurantPermissionKey,
} from "@/lib/permissions/restaurant-permissions";
import {
  createRestaurantPosition,
  fetchPositionPermissionKeys,
  fetchRestaurantPositions,
  updatePositionPermissions,
  type RestaurantPositionRow,
} from "@/lib/supabase/restaurant-positions-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

const GROUP_LABEL = {
  administration: "Verwaltung",
  einstellungen: "Einstellungen",
  integrationen: "Integrationen",
  dokumente: "Dokumente",
  buchfuehrung: "Buchführung",
  display: "Display",
  pos: "Kasse",
} as const;

export function RestaurantRolesPanel() {
  const { restaurantId, has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("roles.manage");

  const [positions, setPositions] = useState<RestaurantPositionRow[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permDraft, setPermDraft] = useState<Set<RestaurantPermissionKey>>(
    new Set(),
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newName, setNewName] = useState("");

  const selected = useMemo(
    () => positions.find((p) => p.id === selectedId) ?? null,
    [positions, selectedId],
  );

  const loadPositions = useCallback(async () => {
    if (!restaurantId) {
      setPositions([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const { rows, error } = await fetchRestaurantPositions(sb, restaurantId);
    if (error) toast.error(error);
    setPositions(rows);
    if (!selectedId && rows[0]) setSelectedId(rows[0].id);
    setLoading(false);
  }, [restaurantId, selectedId]);

  const loadPermissions = useCallback(
    async (positionId: string) => {
      const sb = createSupabaseBrowserClient();
      const { keys, error } = await fetchPositionPermissionKeys(sb, positionId);
      if (error) toast.error(error);
      setPermDraft(new Set(keys));
    },
    [],
  );

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  useEffect(() => {
    if (selectedId) void loadPermissions(selectedId);
  }, [selectedId, loadPermissions]);

  const togglePerm = (key: RestaurantPermissionKey, on: boolean) => {
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const savePermissions = async () => {
    if (!selectedId || selected?.slug === "owner") return;
    setSaving(true);
    const sb = createSupabaseBrowserClient();
    const { error } = await updatePositionPermissions(
      sb,
      selectedId,
      [...permDraft],
    );
    setSaving(false);
    if (error) toast.error(error);
    else toast.success("Berechtigungen gespeichert.");
  };

  const addPosition = async () => {
    if (!restaurantId || !newName.trim()) return;
    const sb = createSupabaseBrowserClient();
    const { id, error } = await createRestaurantPosition(
      sb,
      restaurantId,
      newName,
      null,
    );
    if (error || !id) {
      toast.error(error ?? "Position konnte nicht angelegt werden.");
      return;
    }
    setNewName("");
    toast.success("Position angelegt.");
    await loadPositions();
    setSelectedId(id);
  };

  if (permLoading) {
    return (
      <SkeletonCardFrame className="space-y-4">
        <Skeleton className="h-6 w-40 rounded-md" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </SkeletonCardFrame>
    );
  }

  if (!restaurantId) {
    return (
      <p className="text-sm text-muted-foreground">
        Wähle ein Restaurant im Workspace.
      </p>
    );
  }

  if (!canManage) {
    return (
      <p className="text-sm text-muted-foreground">
        Du hast keine Berechtigung, Rollen zu verwalten.
      </p>
    );
  }

  const byGroup = RESTAURANT_PERMISSION_CATALOG.reduce(
    (acc, item) => {
      (acc[item.group] ??= []).push(item);
      return acc;
    },
    {} as Record<string, typeof RESTAURANT_PERMISSION_CATALOG[number][]>,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-5">
      <Card className="border-border/50 shadow-card lg:col-span-2">
        <CardHeader>
          <CardTitle className="text-base">Positionen</CardTitle>
          <CardDescription>
            Rollen im Restaurant — Berechtigungen pro Position.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <ul className="space-y-1">
            {positions.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    selectedId === p.id
                      ? "bg-accent text-accent-foreground"
                      : "hover:bg-muted/60",
                  )}
                >
                  <span>{p.name}</span>
                  {p.is_system ? (
                    <Badge variant="outline" className="text-[0.625rem]">
                      System
                    </Badge>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-2 pt-2">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Neue Position…"
              className="h-10 rounded-xl"
            />
            <Button
              type="button"
              variant="outline"
              disabled={!newName.trim()}
              onClick={() => void addPosition()}
            >
              Anlegen
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-card lg:col-span-3">
        <CardHeader>
          <CardTitle className="text-base">
            {selected ? selected.name : "Berechtigungen"}
          </CardTitle>
          <CardDescription>
            {selected?.slug === "owner"
              ? "Inhaber hat alle Rechte (nicht einschränkbar)."
              : "Lege fest, was diese Position darf."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {selected?.slug === "owner" ? (
            <p className="text-sm text-muted-foreground">
              Vollzugriff inkl. Rollen, Team, WhatsApp und allen Einstellungen.
            </p>
          ) : (
            Object.entries(byGroup).map(([group, items]) => (
              <div key={group} className="space-y-3">
                <h3 className="text-sm font-medium text-muted-foreground">
                  {GROUP_LABEL[group as keyof typeof GROUP_LABEL] ?? group}
                </h3>
                <ul className="space-y-2">
                  {items.map((item) => (
                    <li
                      key={item.key}
                      className="flex items-start gap-3 rounded-lg border border-border/40 px-3 py-2"
                    >
                      <Checkbox
                        id={`perm-${item.key}`}
                        checked={permDraft.has(item.key)}
                        onCheckedChange={(v) =>
                          togglePerm(item.key, v === true)
                        }
                      />
                      <div className="min-w-0 flex-1">
                        <Label
                          htmlFor={`perm-${item.key}`}
                          className="cursor-pointer font-medium"
                        >
                          {item.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
          {selected && selected.slug !== "owner" ? (
            <div className="flex justify-end">
              <Button
                type="button"
                disabled={saving}
                className={cn(settingsAccentSaveButtonClassName)}
                onClick={() => void savePermissions()}
              >
                {saving ? "Speichern…" : "Berechtigungen speichern"}
              </Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
