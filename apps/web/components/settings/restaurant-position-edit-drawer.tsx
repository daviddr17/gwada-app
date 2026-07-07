"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName } from "@/lib/ui/drawer-form-section";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
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
  fetchPositionPermissionKeys,
  fetchPositionUsageCounts,
  updatePositionPermissions,
  updateRestaurantPosition,
  type PositionUsageCounts,
  type RestaurantPositionRow,
} from "@/lib/supabase/restaurant-positions-db";
import { deleteRestaurantPositionClient } from "@/lib/restaurant/restaurant-positions-client-api";
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
  const [deleteTarget, setDeleteTarget] = useState<RestaurantPositionRow | null>(
    null,
  );

  const isOwner = position?.slug === "owner";
  const canDelete = position != null && !isOwner;
  const deleteDialogOpen = deleteOpen && deleteTarget != null;

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
    if (!open) {
      setDeleteOpen(false);
      setDeleteTarget(null);
    }
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
    const target = deleteTarget ?? position;
    if (!target || target.slug === "owner") {
      toast.error("Diese Rolle kann nicht gelöscht werden.");
      throw new Error("cannot_delete_owner");
    }
    setSaving(true);
    const { error } = await deleteRestaurantPositionClient({
      restaurantId,
      positionId: target.id,
    });
    setSaving(false);
    if (error) {
      const messages: Record<string, string> = {
        forbidden: "Keine Berechtigung zum Löschen.",
        cannot_delete_owner: "Die Inhaber-Rolle kann nicht gelöscht werden.",
        not_found: "Rolle wurde nicht gefunden.",
        delete_failed: "Rolle konnte nicht gelöscht werden.",
        server_misconfigured: "Löschen ist serverseitig nicht verfügbar.",
      };
      toast.error(messages[error] ?? "Rolle konnte nicht gelöscht werden.");
      throw new Error(error);
    }
    toast.success("Position gelöscht.");
    setDeleteOpen(false);
    setDeleteTarget(null);
    onOpenChange(false);
    onDeleted();
  };

  const deleteUsageHint = deleteTarget
    ? formatUsageHint(usageCounts)
    : null;

  const positionColor = position
    ? normalizeRestaurantPositionColor(colorDraft, position.id)
    : undefined;

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && deleteDialogOpen) return;
          onOpenChange(nextOpen);
        }}
        dismissible={!deleteDialogOpen}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("form")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
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
            <div className={drawerScrollAreaClassName(6)}>
              {loading ? (
                <div className="space-y-4" aria-busy="true">
                  <Skeleton className="h-12 w-full rounded-xl" />
                  <Skeleton className="h-5 w-32 rounded-md" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                  <Skeleton className="h-16 w-full rounded-lg" />
                </div>
              ) : (
                <>
                  <DrawerFormSection title="Darstellung">
                    <RestaurantPositionColorField
                      idPrefix="position-edit"
                      color={colorDraft}
                      onColorChange={setColorDraft}
                      fallbackSeed={position?.id}
                    />
                  </DrawerFormSection>

                  <DrawerFormSection title="Berechtigungen">
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
                  </DrawerFormSection>
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
              onDelete={() => {
                if (!position) return;
                setDeleteTarget(position);
                setDeleteOpen(true);
              }}
              deleteLabel="Position löschen"
              deleteDisabled={loading || deleteDialogOpen}
            />
          </div>
        </DrawerContent>
      </Drawer>

      <ConfirmDialog
        open={deleteDialogOpen}
        onOpenChange={(nextOpen) => {
          setDeleteOpen(nextOpen);
          if (!nextOpen) setDeleteTarget(null);
        }}
        title="Position wirklich löschen?"
        description={
          deleteTarget ? (
            <>
              <span className="font-medium text-foreground">
                {deleteTarget.name}
              </span>{" "}
              wird dauerhaft entfernt.
              {deleteUsageHint ? <> {deleteUsageHint}</> : null}
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
