"use client";

import { useCallback, useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton, SkeletonCardFrame } from "@/components/ui/skeleton";
import { RestaurantPositionCreateDrawer } from "@/components/settings/restaurant-position-create-drawer";
import { RestaurantPositionEditDrawer } from "@/components/settings/restaurant-position-edit-drawer";
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import { normalizeRestaurantPositionColor, restaurantPositionSurfaceStyle } from "@/lib/restaurant/restaurant-position-colors";
import {
  createRestaurantPosition,
  fetchRestaurantPositions,
  updatePositionPermissions,
  type RestaurantPositionRow,
} from "@/lib/supabase/restaurant-positions-db";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { modulePrimaryAddButtonFullWidthClassName } from "@/lib/ui/module-primary-add-button";
import { TagColorStripe } from "@/lib/ui/tag-color-stripe";
import { cn } from "@/lib/utils";

export function RestaurantRolesPanel() {
  const { restaurantId, has, loading: permLoading } = useRestaurantPermissions();
  const canManage = has("roles.manage");

  const [positions, setPositions] = useState<RestaurantPositionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editingPosition, setEditingPosition] =
    useState<RestaurantPositionRow | null>(null);

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
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const openEdit = (position: RestaurantPositionRow) => {
    setEditingPosition(position);
    setEditOpen(true);
  };

  const handleCreate = async ({
    name,
    color,
    permissionKeys,
  }: {
    name: string;
    color: string;
    permissionKeys: RestaurantPermissionKey[];
  }) => {
    if (!restaurantId) return;
    setCreating(true);
    const sb = createSupabaseBrowserClient();
    const { id, error } = await createRestaurantPosition(
      sb,
      restaurantId,
      name,
      null,
      color,
    );
    if (error || !id) {
      setCreating(false);
      toast.error(error ?? "Position konnte nicht angelegt werden.");
      return;
    }
    if (permissionKeys.length > 0) {
      const { error: permError } = await updatePositionPermissions(
        sb,
        id,
        permissionKeys,
      );
      if (permError) {
        setCreating(false);
        toast.error(permError);
        return;
      }
    }
    setCreating(false);
    toast.success("Position angelegt.");
    setCreateOpen(false);
    const { rows, error: reloadError } = await fetchRestaurantPositions(
      sb,
      restaurantId,
    );
    if (reloadError) toast.error(reloadError);
    setPositions(rows);
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

  return (
    <>
      <div className="space-y-3">
        <Button
          type="button"
          className={cn(
            modulePrimaryAddButtonFullWidthClassName,
            "h-auto min-h-0 rounded-lg px-3 py-2 text-sm",
          )}
          onClick={() => setCreateOpen(true)}
        >
          <Plus className="size-4" />
          Anlegen
        </Button>

        {loading ? (
          <div className="min-h-[12rem]" aria-busy="true" />
        ) : (
          <ul className="space-y-1">
              {positions.map((p) => {
                const positionColor = normalizeRestaurantPositionColor(
                  p.color,
                  p.id,
                );
                const surface = restaurantPositionSurfaceStyle(positionColor);
                const isActive =
                  editingPosition?.id === p.id && editOpen;

                return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(p)}
                    className={cn(
                      "flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                      isActive
                        ? "font-medium text-foreground"
                        : "hover:bg-muted/40",
                    )}
                    style={{
                      borderColor: surface.borderColor,
                      backgroundColor: isActive
                        ? surface.backgroundColor
                        : undefined,
                    }}
                  >
                    <TagColorStripe
                      color={positionColor}
                      className="mr-0 h-5 shrink-0 self-center"
                    />
                    <span className="min-w-0 flex-1">{p.name}</span>
                    {p.slug === "owner" ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[0.625rem]",
                          isActive &&
                            "border-accent/40 bg-background text-foreground",
                        )}
                      >
                        System
                      </Badge>
                    ) : null}
                  </button>
                </li>
                );
              })}
            </ul>
        )}
      </div>

      <RestaurantPositionCreateDrawer
        open={createOpen}
        onOpenChange={setCreateOpen}
        pending={creating}
        onCreate={(payload) => void handleCreate(payload)}
      />

      <RestaurantPositionEditDrawer
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setEditingPosition(null);
        }}
        position={editingPosition}
        restaurantId={restaurantId}
        onSaved={() => void loadPositions()}
        onDeleted={() => {
          setEditingPosition(null);
          void loadPositions();
        }}
      />
    </>
  );
}
