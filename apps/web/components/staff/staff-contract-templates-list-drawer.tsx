"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { GripVertical, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import { StaffContractTemplateDrawer } from "@/components/staff/staff-contract-template-drawer";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import {
  loadStaffContractTemplates,
  reorderStaffContractTemplates,
} from "@/lib/supabase/staff-contract-templates-db";
import type { StaffContractTemplateRow } from "@/lib/types/staff-contract-templates";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormFullWidthButtonClassName,
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

export function StaffContractTemplatesListDrawer({
  open,
  onOpenChange,
  restaurantId,
  employmentTypeId,
  employmentTypeName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  employmentTypeId: string;
  employmentTypeName: string;
}) {
  const [templates, setTemplates] = useState<StaffContractTemplateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [editTemplateId, setEditTemplateId] = useState<string | null>(null);
  const [templateEditorOpen, setTemplateEditorOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!restaurantId || !employmentTypeId) {
      setTemplates([]);
      return;
    }
    setLoading(true);
    const { data, error } = await loadStaffContractTemplates(
      restaurantId,
      employmentTypeId,
    );
    setLoading(false);
    if (error) toast.error(error);
    else setTemplates(data);
  }, [restaurantId, employmentTypeId]);

  useEffect(() => {
    if (!open) return;
    void reload();
  }, [open, reload]);

  const templateIds = useMemo(() => templates.map((t) => t.id), [templates]);

  const sort = useSortableReorder({
    itemIds: templateIds,
    onReorder: ({ fromIndex, toIndex }) => {
      setTemplates((prev) => {
        const next = [...prev];
        const [removed] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, removed);
        void reorderStaffContractTemplates(next.map((t) => t.id));
        return next;
      });
    },
  });

  const openNew = () => {
    setEditTemplateId(null);
    setTemplateEditorOpen(true);
  };

  const openEdit = (id: string) => {
    setEditTemplateId(id);
    setTemplateEditorOpen(true);
  };

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className={drawerContentClassName("overview")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Mustervorlagen
            </DrawerTitle>
            <DrawerDescription className="text-base">
              {employmentTypeName} — Vorlagen für die digitale Vertragserstellung.
            </DrawerDescription>
          </DrawerHeader>

          <div className={drawerScrollAreaClassName(6)}>
            <Button
              type="button"
              variant="secondary"
              className={cn("mb-3 h-11 shrink-0", drawerFormFullWidthButtonClassName)}
              onClick={openNew}
            >
              <Plus className="size-4" />
              Neue Mustervorlage
            </Button>

            <DrawerFormSection bleed={false} className="flex-1">
              {loading ? (
                <p className="text-sm text-muted-foreground">Wird geladen …</p>
              ) : templates.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Noch keine Mustervorlagen — lege die erste an.
                </p>
              ) : (
                <ul className="space-y-2">
                  {templates.map((template, index) => {
                    const handle = sort.getHandleProps(template.id);
                    return (
                      <li
                        key={template.id}
                        ref={(el) => sort.registerItemRef(template.id, el)}
                        className={sort.getItemDropClassName(
                          template.id,
                          "flex items-center gap-2 rounded-xl border border-border/40 bg-background/70 p-2",
                        )}
                      >
                        <div
                          {...handle}
                          className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 text-muted-foreground",
                            handle.className,
                          )}
                        >
                          <GripVertical className="size-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {template.name}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {template.title || "Ohne Überschrift"}
                            {!template.is_active ? " · inaktiv" : ""}
                            {" · "}Position {index + 1}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          className="rounded-lg"
                          aria-label="Mustervorlage bearbeiten"
                          onClick={() => openEdit(template.id)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <SortableDragOverlay
                activeId={sort.activeId}
                dragLayout={sort.dragLayout}
                showGapLine={sort.wouldReorder}
                renderGhost={(id) => {
                  const template = templates.find((t) => t.id === id);
                  if (!template) return null;
                  return (
                    <div className="flex items-center gap-2 p-2">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40">
                        <GripVertical className="size-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {template.name}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />
            </DrawerFormSection>
          </div>
        </DrawerContent>
      </Drawer>

      <StaffContractTemplateDrawer
        open={templateEditorOpen}
        onOpenChange={setTemplateEditorOpen}
        restaurantId={restaurantId}
        employmentTypeId={employmentTypeId}
        employmentTypeName={employmentTypeName}
        templateId={editTemplateId}
        onSaved={() => void reload()}
      />
    </>
  );
}
