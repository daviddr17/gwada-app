"use client";

import { DishForm } from "@/components/menu/dish-form";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { INVENTORY_UNITS_KEY } from "@/lib/constants/inventory-storage";
import { SEED_UNITS } from "@/lib/data/inventory-seeds";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
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
  onCreate: (item: NewMenuItem) => boolean;
  onUpdate: (id: string, item: NewMenuItem) => boolean;
  categories: MenuCategoryDefinition[];
};

export function DishDrawer({
  open,
  onOpenChange,
  mode,
  editItem,
  onCreate,
  onUpdate,
  categories,
}: DishDrawerProps) {
  const { ingredients } = useIngredientsStorage();
  const { items: stockUnits } = useInventoryTaxonomyStorage(
    INVENTORY_UNITS_KEY,
    SEED_UNITS,
  );

  const handleSubmit = (item: NewMenuItem) => {
    const ok =
      mode === "edit" && editItem
        ? onUpdate(editItem.id, item)
        : onCreate(item);
    if (ok) onOpenChange(false);
  };

  const formKey =
    mode === "edit" && editItem ? `edit-${editItem.id}` : "create";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent
        showHandle
        className="mx-auto flex max-h-[min(92dvh,640px)] max-w-lg flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated"
      >
        <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {mode === "edit" ? "Gericht bearbeiten" : "Gericht hinzufügen"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            {mode === "edit"
              ? "Änderungen werden lokal gespeichert."
              : "Neues Gericht zur Speisekarte hinzufügen."}
          </DrawerDescription>
        </DrawerHeader>
        <DishForm
          key={formKey}
          mode={mode}
          initialItem={editItem}
          categories={categories}
          ingredients={ingredients}
          stockUnits={stockUnits}
          onSubmit={handleSubmit}
          onCancel={() => onOpenChange(false)}
        />
      </DrawerContent>
    </Drawer>
  );
}
