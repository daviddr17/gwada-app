"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { DishForm } from "@/components/menu/dish-form";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import {
  MENU_TAXONOMY_ALLERGENS_KEY,
  MENU_TAXONOMY_TAGS_KEY,
  SEED_MENU_ALLERGEN_DEFINITIONS,
  SEED_MENU_TAG_DEFINITIONS,
} from "@/lib/constants/menu-taxonomy-storage";
import { INVENTORY_UNITS_KEY } from "@/lib/constants/inventory-storage";
import { SEED_UNITS } from "@/lib/data/inventory-seeds";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import { useMenuTaxonomyStorage } from "@/lib/hooks/use-menu-taxonomy-storage";
import type {
  MenuCategoryDefinition,
  MenuItem,
  NewMenuItem,
} from "@/lib/types/menu";

type DishDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  editItem?: MenuItem;
  onCreate: (item: NewMenuItem) => boolean | Promise<boolean>;
  onUpdate: (id: string, item: NewMenuItem) => boolean | Promise<boolean>;
  /** Nur Bearbeiten: Gericht endgültig löschen */
  onDelete?: (id: string) => boolean | Promise<boolean>;
  categories: MenuCategoryDefinition[];
};

export function DishDrawer({
  open,
  onOpenChange,
  mode,
  editItem,
  onCreate,
  onUpdate,
  onDelete,
  categories,
}: DishDrawerProps) {
  const { ingredients } = useIngredientsStorage();
  const { items: stockUnits } = useInventoryTaxonomyStorage(
    INVENTORY_UNITS_KEY,
    SEED_UNITS,
  );
  const menuTags = useMenuTaxonomyStorage(
    MENU_TAXONOMY_TAGS_KEY,
    SEED_MENU_TAG_DEFINITIONS,
  );
  const menuAllergens = useMenuTaxonomyStorage(
    MENU_TAXONOMY_ALLERGENS_KEY,
    SEED_MENU_ALLERGEN_DEFINITIONS,
  );
  const tagDefinitions = React.useMemo(
    () => [...menuTags.items, ...menuAllergens.items],
    [menuTags.items, menuAllergens.items],
  );

  const [confirmDeleteOpen, setConfirmDeleteOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) setConfirmDeleteOpen(false);
  }, [open]);

  const handleSubmit = (item: NewMenuItem) => {
    void (async () => {
      const raw =
        mode === "edit" && editItem
          ? onUpdate(editItem.id, item)
          : onCreate(item);
      const ok = await Promise.resolve(raw);
      if (ok) onOpenChange(false);
    })();
  };

  const formKey =
    mode === "edit" && editItem ? `edit-${editItem.id}` : "create";

  const handleConfirmDelete = async () => {
    if (!editItem || !onDelete) return;
    const ok = await Promise.resolve(onDelete(editItem.id));
    if (ok) onOpenChange(false);
  };

  return (
    <>
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        className="mx-auto flex max-h-[min(92dvh,640px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1 text-left">
              <DrawerTitle className="text-xl font-semibold tracking-tight">
                {mode === "edit" ? "Gericht bearbeiten" : "Gericht hinzufügen"}
              </DrawerTitle>
              <DrawerDescription className="text-base">
                {mode === "edit"
                  ? "Änderungen werden lokal gespeichert."
                  : "Neues Gericht zur Speisekarte hinzufügen."}
              </DrawerDescription>
            </div>
            {mode === "edit" && editItem && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-destructive"
                aria-label="Gericht löschen"
                onClick={() => setConfirmDeleteOpen(true)}
              >
                <Trash2 className="size-4" />
              </Button>
            ) : null}
          </div>
        </DrawerHeader>
        <DishForm
          key={formKey}
          mode={mode}
          initialItem={editItem}
          categories={categories}
          ingredients={ingredients}
          tagDefinitions={tagDefinitions}
          stockUnits={stockUnits}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>

    <ConfirmDialog
      open={confirmDeleteOpen}
      onOpenChange={setConfirmDeleteOpen}
      title="Gericht wirklich löschen?"
      description={
        editItem ? (
          <>
            „<span className="font-medium text-foreground">{editItem.name}</span>“
            wird dauerhaft aus der Speisekarte entfernt.
          </>
        ) : null
      }
      confirmLabel="Ja, löschen"
      onConfirm={handleConfirmDelete}
    />
    </>
  );
}
