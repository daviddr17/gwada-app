"use client";

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
}: CategoriesManageDrawerProps) {
  const copy = { ...DEFAULT_MANAGE_COPY, ...copyProp };
  const [local, setLocal] = React.useState(categories);
  const [dragId, setDragId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!open) return;
    setLocal([...categories]);
  }, [open, categories]);

  const ordered = local;

  const move = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return;
    if (fromIndex >= ordered.length || toIndex >= ordered.length) return;
    const next = [...ordered];
    const [removed] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, removed);
    setLocal(next);
    onReorder(next);
  };

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
        showHandle
        className="mx-auto flex max-h-[min(88dvh,560px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {copy.title}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {copy.description}
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-2 overflow-y-auto px-6 pb-4">
          <Button
            type="button"
            variant="secondary"
            className="h-11 rounded-xl"
            onClick={() => {
              onNew();
              onOpenChange(false);
            }}
          >
            {copy.newButton}
          </Button>

          <ul className="space-y-2 pt-1">
            {ordered.map((cat, index) => (
              <li
                key={cat.id}
                draggable
                onDragStart={() => setDragId(cat.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!dragId || dragId === cat.id) return;
                  const from = ordered.findIndex((c) => c.id === dragId);
                  const to = index;
                  move(from, to);
                  setDragId(null);
                }}
                onDragEnd={() => setDragId(null)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 p-2 shadow-none dark:shadow-xs",
                  dragId === cat.id && "opacity-60",
                )}
              >
                <div className="flex size-10 shrink-0 cursor-grab touch-none items-center justify-center rounded-lg border border-border/40 bg-background text-muted-foreground active:cursor-grabbing">
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
            ))}
          </ul>
        </div>

        <div className="border-t border-border/50 px-6 py-3">
          <Button
            type="button"
            variant="outline"
            className="h-11 w-full rounded-xl"
            onClick={() => onOpenChange(false)}
          >
            Schließen
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
