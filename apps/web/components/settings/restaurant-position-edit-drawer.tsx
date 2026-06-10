"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Skeleton } from "@/components/ui/skeleton";
import {
  RestaurantPositionColorField,
  resolvePositionColorInput,
} from "@/components/settings/restaurant-position-color-field";
import {
  permissionSetsEqual,
  RestaurantPositionPermissionFields,
} from "@/components/settings/restaurant-position-permission-fields";
import type { RestaurantPermissionKey } from "@/lib/permissions/restaurant-permissions";
import { normalizeRestaurantPositionColor } from "@/lib/restaurant/restaurant-position-colors";
import {
  deleteRestaurantPosition,
  fetchPositionPermissionKeys,
  fetchPositionUsageCounts,
  updatePositionPermissions,
  updateRestaurantPosition,
  type PositionUsageCounts,
  type RestaurantPositionRow,
} from "@/lib/supabase/restaurant-positions-db";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { TagColorStripe } from "@/lib/ui/tag-color-stripe";

function formatUsageHint(counts: PositionUsageCounts): string | null {
  const parts: string[] = [];
  if (counts.employeeCount > 0) {
    parts.push(
      `${counts.employeeCount} Team-Mitglied${counts.employeeCount === 1 ? "" : "er"}`,
    );
  }
  if (counts.staffCount > 0) {
    parts.push(`${counts.staffCount} Mitarbeiter`);
  }
  if (counts.pendingInviteCount > 0) {
    parts.push(
      `${counts.pendingInviteCount} offene Einladung${counts.pendingInviteCount === 1 ? "" : "en"}`,
    );
  }
  if (parts.length === 0) return null;
  return `Diese Position ist ${parts.join(", ")} zugeordnet. Beim Löschen entfällt die Zuordnung.`;
}

type RestaurantPositionEditDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: RestaurantPositionRow | null;
  restaurantId: string;
  onSaved: () => void;
  onDeleted: () => void;
};

export function RestaurantPositionEditDrawer({
  open,
  onOpenChange,
  position,
  restaurantId,
  onSaved,
  onDeleted,
}: RestaurantPositionEditDrawerProps) {
  const [permDraft, setPermDraft] = useState<Set<RestaurantPermissionKey>>(
    new Set(),
  );
  const [permBaseline, setPermBaseline] = useState<
    Set<RestaurantPermissionKey>
  >(new Set());
  const [colorDraft, setColorDraft] = useState("#64748b");
  const [colorBaseline, setColorBaseline] = useState("#64748b");
  const [usageCounts, setUsageCounts] = useState<PositionUsageCounts>({
    employeeCount: 0,
    staffCount: 0,
    pendingInviteCount: 0,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const isOwner = position?.slug === "owner";
  const canDelete = position != null && !isOwner;

  const colorDirty = colorDraft !== colorBaseline;
  const permDirty = useMemo(() => {
    if (!position || isOwner) return false;
    return !permissionSetsEqual(permDraft, permBaseline);
  }, [permDraft, permBaseline, isOwner, position]);
  const dirty = colorDirty || permDirty;

  const usageHint = formatUsageHint(usageCounts);

  const loadData = useCallback(async () => {
    if (!position || !restaurantId) return;
    setLoading(true);
    const sb = createSupabaseBrowserClient();
    const [{ keys, error: permError }, usageResult] = await Promise.all([
      fetchPositionPermissionKeys(sb, position.id),
      position.slug === "owner"
        ? Promise.resolve({
            counts: {
              employeeCount: 0,
              staffCount: 0,
              pendingInviteCount: 0,
            },
            error: null,
          })
        : fetchPositionUsageCounts(sb, restaurantId, position.id),
    ]);
    const { counts, error: usageError } = usageResult;
    if (permError) toast.error(permError);
    if (usageError) toast.error(usageError);
    const nextColor = normalizeRestaurantPositionColor(
      position.color,
      position.id,
    );
    setColorDraft(nextColor);
    setColorBaseline(nextColor);
    const next = new Set(keys);
    setPermDraft(next);
    setPermBaseline(new Set(keys));
    setUsageCounts(counts);
    setLoading(false);
  }, [position, restaurantId]);

  useEffect(() => {
    if (open && position) void loadData();
  }, [open, position, loadData]);

  useEffect(() => {
    if (!open) setDeleteOpen(false);
  }, [open]);

  const togglePerm = (key: RestaurantPermissionKey, on: boolean) => {
    setPermDraft((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const save = async () => {
    if (!position || !dirty) return;
    setSaving(true);
    const sb = createSupabaseBrowserClient();

    if (colorDirty) {
      const { error } = await updateRestaurantPosition(sb, position.id, {
        color: resolvePositionColorInput(colorDraft, position.id),
      });
      if (error) {
        setSaving(false);
        toast.error(error);
        return;
      }
      setColorBaseline(resolvePositionColorInput(colorDraft, position.id));
    }

    if (permDirty && !isOwner) {
      const { error } = await updatePositionPermissions(
        sb,
        position.id,
        [...permDraft],
      );
      if (error) {
        setSaving(false);
        toast.error(error);
        return;
      }
      setPermBaseline(new Set(permDraft));
    }

    setSaving(false);
    toast.success("Position gespeichert.");
    onSaved();
    onOpenChange(false);
  };

  const confirmDelete = async () => {
    if (!position || !canDelete) return;
    setSaving(true);
    const sb = createSupabaseBrowserClient();
    const { error } = await deleteRestaurantPosition(sb, position.id);
    setSaving(false);
    if (error) {
      toast.error(error);
      return;
    }
    toast.success("Position gelöscht.");
    setDeleteOpen(false);
    onOpenChange(false);
    onDeleted();
  };

  const positionColor = position
    ? normalizeRestaurantPositionColor(colorDraft, position.id)
    : undefined;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <DrawerTitle className="flex items-center gap-2 text-xl font-semibold tracking-tight">
              {position ? (
                <>
                  <TagColorStripe
                    color={positionColor}
                    className="mr-0 h-5 shrink-0"
                  />
                  <span>{position.name}</span>
                </>
              ) : (
                "Position"
              )}
            </DrawerTitle>
            <DrawerDescription className="text-base">
              {isOwner
                ? "Inhaber hat alle Rechte. Farbe ist anpassbar."
                : "Farbe und Berechtigungen für diese Position."}
            </DrawerDescription>
          </DrawerHeader>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 pb-4">
              {loading ? (
                <div className="space-y-4" aria-busy="true">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  <RestaurantPositionColorField
                    idPrefix="position-edit"
                    color={colorDraft}
                    onColorChange={setColorDraft}
                    fallbackSeed={position?.id}
                  />

                  {isOwner ? (
                    <p className="text-sm text-muted-foreground">
                      Vollzugriff inkl. Rollen, Team, WhatsApp und allen
                      Einstellungen — Berechtigungen sind nicht einschränkbar.
                    </p>
                  ) : (
                    <RestaurantPositionPermissionFields
                      idPrefix="perm-edit"
                      permDraft={permDraft}
                      onToggle={togglePerm}
                    />
                  )}

                  {canDelete && usageHint ? (
                    <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-950 dark:text-amber-100">
                      {usageHint}
                    </p>
                  ) : null}
                </>
              )}
            </div>

            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitType="button"
              onSubmit={() => void save()}
              submitLabel="Speichern"
              submitPending={saving}
              submitDisabled={!dirty || loading}
              showDelete={canDelete}
              onDelete={() => setDeleteOpen(true)}
              deleteLabel="Position löschen"
              deleteDisabled={loading}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title="Position wirklich löschen?"
        description={
          position ? (
            <>
              <span className="font-medium text-foreground">
                {position.name}
              </span>{" "}
              wird dauerhaft entfernt.
              {usageHint ? <> {usageHint}</> : null}
            </>
          ) : null
        }
        confirmLabel="Position löschen"
        destructive
        confirmDisabled={saving}
        onConfirm={confirmDelete}
      />
    </>
  );
}
