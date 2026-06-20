"use client";

import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerScrollAreaClassName, drawerFormHeaderClassName, drawerFormFullWidthButtonClassName } from "@/lib/ui/drawer-form-section";
import { GripVertical, Pencil } from "lucide-react";
import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import { cn } from "@/lib/utils";

/** Kategorien, Lieferanten, Tags, … – gemeinsame Listen-Zeile. */
export type ManageableListItem = {
  id: string;
  name: string;
  active?: boolean;
};

export type CategoriesManageDrawerCopy = {
  title: string;
  description: string;
  newButton: string;
};

const DEFAULT_MANAGE_COPY: CategoriesManageDrawerCopy = {
  title: "Kategorien",
  description:
    "Reihenfolge per Ziehen ändern (1 = oben). Inaktive Kategorien werden in der Leiste abgeschwächt.",
  newButton: "Neue Kategorie",
};

type CategoriesManageDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: ManageableListItem[];
  onReorder: (next: ManageableListItem[]) => void;
  onEdit: (row: ManageableListItem) => void;
  onNew: () => void;
  /** z. B. Farbpunkt bei Tag-Stammdaten */
  rowLeading?: (row: ManageableListItem) => React.ReactNode;
  /** z. B. Bestand: Lieferanten, Marken, … */
  copy?: Partial<CategoriesManageDrawerCopy>;
  /** z. B. Bereichs-Dropdown bei Buchführungs-Status */
  afterDescription?: React.ReactNode;
};

export function CategoriesManageDrawer({
  open,
  onOpenChange,
  categories,
  onReorder,
  onEdit,
  onNew,
  rowLeading,
  copy: copyProp,
  afterDescription,
}: CategoriesManageDrawerProps) {
  const copy = { ...DEFAULT_MANAGE_COPY, ...copyProp };
  const [local, setLocal] = React.useState(categories);

  React.useEffect(() => {
    if (!open) return;
    setLocal([...categories]);
  }, [open, categories]);

  const ordered = local;
  const itemIds = React.useMemo(() => ordered.map((c) => c.id), [ordered]);

  const sort = useSortableReorder({
    itemIds,
    onReorder: ({ fromIndex, toIndex }) => {
      const next = [...ordered];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      setLocal(next);
      onReorder(next);
    },
  });

  const toggleActive = (id: string, active: boolean) => {
    const next = ordered.map((c) =>
      c.id === id ? { ...c, active } : c,
    );
    setLocal(next);
    onReorder(next);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className={drawerContentClassName("overview")}
      >
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {copy.title}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {copy.description}
          </DrawerDescription>
          {afterDescription ? (
            <div className="pt-3">{afterDescription}</div>
          ) : null}
        </DrawerHeader>

        <div className={drawerScrollAreaClassName(6)}>
          <Button
            type="button"
            variant="secondary"
            className="mb-3 h-11 shrink-0 rounded-xl"
            onClick={() => {
              onNew();
              onOpenChange(false);
            }}
          >
            {copy.newButton}
          </Button>

          <DrawerFormSection bleed={false} className="flex-1">
          <ul className="space-y-2">
            {ordered.map((cat, index) => {
              const handle = sort.getHandleProps(cat.id);
              return (
              <li
                key={cat.id}
                ref={(el) => sort.registerItemRef(cat.id, el)}
                className={sort.getItemDropClassName(
                  cat.id,
                  "flex items-center gap-2 rounded-xl border border-border/40 bg-background/70 p-2 shadow-none dark:shadow-xs",
                )}
              >
                <div
                  {...handle}
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background text-muted-foreground",
                    handle.className,
                  )}
                >
                  <GripVertical className="size-5" />
                </div>
                {rowLeading ? (
                  <div className="flex shrink-0 items-center justify-center">
                    {rowLeading(cat)}
                  </div>
                ) : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{cat.name}</p>
                  <p className="text-xs text-muted-foreground">
                    Position {index + 1}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Label
                      htmlFor={`cat-active-${cat.id}`}
                      className="text-xs text-muted-foreground"
                    >
                      Aktiv
                    </Label>
                    <Switch
                      id={`cat-active-${cat.id}`}
                      checked={cat.active !== false}
                      onCheckedChange={(v) => toggleActive(cat.id, v === true)}
                      size="sm"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-lg"
                    aria-label="Bearbeiten"
                    onClick={() => {
                      onEdit(cat);
                      onOpenChange(false);
                    }}
                  >
                    <Pencil className="size-4" />
                  </Button>
                </div>
              </li>
              );
            })}
          </ul>
          <SortableDragOverlay
            activeId={sort.activeId}
            dragLayout={sort.dragLayout}
            showGapLine={sort.wouldReorder}
            renderGhost={(id) => {
              const cat = ordered.find((c) => c.id === id);
              if (!cat) return null;
              return (
                <div className="flex items-center gap-2 p-2">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-background text-muted-foreground">
                    <GripVertical className="size-5" />
                  </div>
                  {rowLeading ? (
                    <div className="flex shrink-0">{rowLeading(cat)}</div>
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{cat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Position {ordered.findIndex((c) => c.id === id) + 1}
                    </p>
                  </div>
                </div>
              );
            }}
          />
          </DrawerFormSection>
        </div>

        <div className="border-t border-border/50 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className={drawerFormFullWidthButtonClassName}
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
