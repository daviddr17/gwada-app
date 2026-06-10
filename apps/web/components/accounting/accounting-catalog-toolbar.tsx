"use client";

import { useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  AccountingArticleRecipeEditor,
  normalizeRecipeDraft,
  recipeDraftFromLines,
  type AccountingArticleRecipeDraftLine,
} from "@/components/accounting/accounting-article-recipe-editor";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import {
  CategoriesManageDrawer,
  type ManageableListItem,
} from "@/components/menu/categories-manage-drawer";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormFooter } from "@/components/ui/drawer-form-footer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SearchableSelect } from "@/components/ui/combobox";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { INVENTORY_UNITS_KEY } from "@/lib/constants/inventory-storage";
import { SEED_UNITS } from "@/lib/data/inventory-seeds";
import { useIngredientsStorage } from "@/lib/hooks/use-ingredients-storage";
import { useInventoryTaxonomyStorage } from "@/lib/hooks/use-inventory-taxonomy-storage";
import {
  deleteAccountingArticle,
  deleteAccountingTaxRate,
  deleteAccountingUnit,
  reorderAccountingTaxRates,
  reorderAccountingUnits,
  saveAccountingArticle,
  saveAccountingTaxRate,
  saveAccountingUnit,
} from "@/lib/accounting/accounting-api";
import type {
  AccountingArticleRecipeLine,
  AccountingArticleRow,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";
import type { Ingredient, InventoryTaxonomyDefinition } from "@/lib/types/inventory";
import {
  accountingFormControlClassName,
  accountingFormGridClassName,
  accountingFormSelectClassName,
} from "@/lib/ui/accounting-form-styles";

type CatalogState = {
  taxRates: AccountingTaxRateRow[];
  units: AccountingUnitRow[];
  articles: AccountingArticleRow[];
};

export function AccountingCatalogToolbar({
  restaurantId,
  catalog,
  onRefresh,
  disabled,
}: {
  restaurantId: string;
  catalog: CatalogState;
  onRefresh: () => void;
  disabled?: boolean;
}) {
  const ingredientsStorage = useIngredientsStorage();
  const stockUnits = useInventoryTaxonomyStorage(INVENTORY_UNITS_KEY, SEED_UNITS);

  const [taxManageOpen, setTaxManageOpen] = useState(false);
  const [unitManageOpen, setUnitManageOpen] = useState(false);
  const [articleManageOpen, setArticleManageOpen] = useState(false);

  const [taxEdit, setTaxEdit] = useState<AccountingTaxRateRow | null>(null);
  const [taxFormOpen, setTaxFormOpen] = useState(false);
  const [unitEdit, setUnitEdit] = useState<ManageableListItem | null>(null);
  const [unitFormOpen, setUnitFormOpen] = useState(false);
  const [articleEdit, setArticleEdit] = useState<AccountingArticleRow | null>(
    null,
  );
  const [articleFormOpen, setArticleFormOpen] = useState(false);

  const taxItems = useMemo<ManageableListItem[]>(
    () =>
      catalog.taxRates.map((t) => ({
        id: t.id,
        name: `${t.label} (${t.rate_percent} %)`,
        active: !t.archived,
      })),
    [catalog.taxRates],
  );

  const unitItems = useMemo<ManageableListItem[]>(
    () =>
      catalog.units.map((u) => ({
        id: u.id,
        name: u.name,
        active: !u.archived,
      })),
    [catalog.units],
  );

  const articleItems = useMemo<ManageableListItem[]>(
    () =>
      catalog.articles.map((a) => ({
        id: a.id,
        name: a.name,
        active: !a.archived,
      })),
    [catalog.articles],
  );

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
          onClick={() => setTaxManageOpen(true)}
        >
          Steuersätze
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
          onClick={() => setUnitManageOpen(true)}
        >
          Einheiten
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
          onClick={() => setArticleManageOpen(true)}
        >
          Artikel
        </Button>
      </div>

      <CategoriesManageDrawer
        open={taxManageOpen}
        onOpenChange={setTaxManageOpen}
        categories={taxItems}
        copy={{
          title: "Steuersätze",
          description:
            "Frei wählbare Sätze — Reihenfolge per Ziehen. Inaktive erscheinen nicht in Positionen.",
          newButton: "Neuer Steuersatz",
        }}
        onReorder={async (next) => {
          try {
            await reorderAccountingTaxRates(
              restaurantId,
              next.map((n) => n.id),
            );
            onRefresh();
          } catch {
            toast.error("Reihenfolge konnte nicht gespeichert werden.");
          }
        }}
        onEdit={(row) => {
          const tax = catalog.taxRates.find((t) => t.id === row.id);
          if (tax) {
            setTaxEdit(tax);
            setTaxFormOpen(true);
          }
        }}
        onNew={() => {
          setTaxEdit(null);
          setTaxFormOpen(true);
        }}
      />

      <TaxRateFormDrawer
        open={taxFormOpen}
        onOpenChange={setTaxFormOpen}
        initial={taxEdit}
        onSave={async (payload) => {
          try {
            await saveAccountingTaxRate(restaurantId, payload);
            onRefresh();
            toast.success("Steuersatz gespeichert.");
          } catch {
            toast.error("Steuersatz konnte nicht gespeichert werden.");
          }
        }}
        onDelete={
          taxEdit
            ? async (id) => {
                try {
                  await deleteAccountingTaxRate(restaurantId, id);
                  onRefresh();
                  toast.success("Steuersatz gelöscht.");
                } catch {
                  toast.error("Steuersatz konnte nicht gelöscht werden.");
                }
              }
            : undefined
        }
      />

      <CategoriesManageDrawer
        open={unitManageOpen}
        onOpenChange={setUnitManageOpen}
        categories={unitItems}
        copy={{
          title: "Einheiten",
          description: "z. B. Stück, Stunde, Pauschal — Reihenfolge per Ziehen.",
          newButton: "Neue Einheit",
        }}
        onReorder={async (next) => {
          try {
            await reorderAccountingUnits(
              restaurantId,
              next.map((n) => n.id),
            );
            onRefresh();
          } catch {
            toast.error("Reihenfolge konnte nicht gespeichert werden.");
          }
        }}
        onEdit={(row) => {
          setUnitEdit(row);
          setUnitFormOpen(true);
        }}
        onNew={() => {
          setUnitEdit(null);
          setUnitFormOpen(true);
        }}
      />

      <CategoryDrawer
        open={unitFormOpen}
        onOpenChange={setUnitFormOpen}
        mode={unitEdit ? "edit" : "create"}
        initial={
          unitEdit
            ? { id: unitEdit.id, name: unitEdit.name, active: unitEdit.active }
            : null
        }
        labels={{
          titleCreate: "Neue Einheit",
          titleEdit: "Einheit bearbeiten",
          description: "Kurzbezeichnung für Positionen und Artikel.",
          namePlaceholder: "z. B. Stunde",
          activeDescription: "Inaktive Einheiten stehen in Auswahlfeldern nicht zur Verfügung.",
          deleteLabel: "Einheit löschen",
          deleteConfirmTitle: "Einheit wirklich löschen?",
        }}
        onSave={async (payload) => {
          try {
            await saveAccountingUnit(restaurantId, {
              id: payload.id,
              name: payload.name,
              archived: payload.active === false,
            });
            onRefresh();
            toast.success("Einheit gespeichert.");
          } catch {
            toast.error("Einheit konnte nicht gespeichert werden.");
          }
        }}
        onDelete={
          unitEdit
            ? async (id) => {
                try {
                  await deleteAccountingUnit(restaurantId, id);
                  onRefresh();
                  toast.success("Einheit gelöscht.");
                } catch {
                  toast.error("Einheit konnte nicht gelöscht werden.");
                }
              }
            : undefined
        }
      />

      <CategoriesManageDrawer
        open={articleManageOpen}
        onOpenChange={setArticleManageOpen}
        categories={articleItems}
        copy={{
          title: "Artikel",
          description: "Wiederverwendbare Positionen für Rechnungen und Angebote.",
          newButton: "Neuer Artikel",
        }}
        onReorder={() => {}}
        onEdit={(row) => {
          const article = catalog.articles.find((a) => a.id === row.id);
          if (article) {
            setArticleEdit(article);
            setArticleFormOpen(true);
          }
        }}
        onNew={() => {
          setArticleEdit(null);
          setArticleFormOpen(true);
        }}
      />

      <ArticleFormDrawer
        open={articleFormOpen}
        onOpenChange={setArticleFormOpen}
        initial={articleEdit}
        units={catalog.units}
        taxRates={catalog.taxRates}
        ingredients={ingredientsStorage.ingredients}
        stockUnits={stockUnits.items}
        onSave={async (payload) => {
          try {
            await saveAccountingArticle(restaurantId, payload);
            onRefresh();
            toast.success("Artikel gespeichert.");
          } catch {
            toast.error("Artikel konnte nicht gespeichert werden.");
          }
        }}
        onDelete={
          articleEdit
            ? async (id) => {
                try {
                  await deleteAccountingArticle(restaurantId, id);
                  onRefresh();
                  toast.success("Artikel gelöscht.");
                } catch {
                  toast.error("Artikel konnte nicht gelöscht werden.");
                }
              }
            : undefined
        }
      />
    </>
  );
}

function TaxRateFormDrawer({
  open,
  onOpenChange,
  initial,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: AccountingTaxRateRow | null;
  onSave: (payload: {
    id?: string;
    label: string;
    rate_percent: number;
    is_default?: boolean;
    archived?: boolean;
  }) => Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [rate, setRate] = useState("0");
  const [isDefault, setIsDefault] = useState(false);
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLabel(initial?.label ?? "");
    setRate(String(initial?.rate_percent ?? 0));
    setIsDefault(initial?.is_default ?? false);
    setActive(!initial?.archived);
  }, [open, initial]);

  const canDelete = Boolean(initial && onDelete);

  const handleConfirmDelete = async () => {
    if (!initial || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className="mx-auto max-w-lg rounded-t-[1.75rem]">
          <DrawerHeader>
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 text-left">
                <DrawerTitle>
                  {initial ? "Steuersatz bearbeiten" : "Neuer Steuersatz"}
                </DrawerTitle>
                <DrawerDescription>
                  Bezeichnung und Prozentsatz — international frei wählbar.
                </DrawerDescription>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Steuersatz löschen"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </DrawerHeader>
          <form
            className="space-y-4 px-4 pb-4"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setSaving(true);
                try {
                  await onSave({
                    id: initial?.id,
                    label: label.trim(),
                    rate_percent: Number(rate) || 0,
                    is_default: isDefault,
                    archived: !active,
                  });
                  onOpenChange(false);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            <div className={accountingFormGridClassName}>
              <div className="space-y-2">
                <Label>Bezeichnung</Label>
                <Input
                  className={accountingFormControlClassName}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="z. B. 19 %"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Satz (%)</Label>
                <Input
                  className={accountingFormControlClassName}
                  type="number"
                  min={0}
                  step="0.01"
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Standard-Satz</Label>
              <Switch checked={isDefault} onCheckedChange={setIsDefault} />
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Aktiv</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>
            <DrawerFormFooter
              onCancel={() => onOpenChange(false)}
              submitLabel="Speichern"
              submitPending={saving}
            />
          </form>
        </DrawerContent>
      </Drawer>

      {canDelete ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Steuersatz wirklich löschen?"
          description={
            initial ? (
              <>
                „<span className="font-medium text-foreground">{initial.label}</span>“
                wird dauerhaft entfernt.
              </>
            ) : null
          }
          confirmLabel="Löschen"
          destructive
          confirmDisabled={deleting}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </>
  );
}

function ArticleFormDrawer({
  open,
  onOpenChange,
  initial,
  units,
  taxRates,
  ingredients,
  stockUnits,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initial: AccountingArticleRow | null;
  units: AccountingUnitRow[];
  taxRates: AccountingTaxRateRow[];
  ingredients: Ingredient[];
  stockUnits: InventoryTaxonomyDefinition[];
  onSave: (payload: {
    id?: string;
    name: string;
    description?: string | null;
    default_unit_name: string;
    default_unit_price: number;
    default_tax_rate_percent: number;
    archived?: boolean;
    recipe?: AccountingArticleRecipeLine[] | null;
  }) => Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [unitName, setUnitName] = useState("Stück");
  const [price, setPrice] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [active, setActive] = useState(true);
  const [recipeLines, setRecipeLines] = useState<AccountingArticleRecipeDraftLine[]>(
    [],
  );
  const [saving, setSaving] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name ?? "");
    setDescription(initial?.description ?? "");
    setUnitName(initial?.default_unit_name ?? "Stück");
    setPrice(String(initial?.default_unit_price ?? 0));
    setTaxRate(String(initial?.default_tax_rate_percent ?? 0));
    setActive(!initial?.archived);
    setRecipeLines(recipeDraftFromLines(initial?.recipe));
  }, [open, initial]);

  const unitOptions = units.map((u) => ({ value: u.name, label: u.name }));
  const taxOptions = taxRates.map((t) => ({
    value: String(t.rate_percent),
    label: t.label,
  }));

  const canDelete = Boolean(initial && onDelete);

  const handleConfirmDelete = async () => {
    if (!initial || !onDelete) return;
    setDeleting(true);
    try {
      await onDelete(initial.id);
      setConfirmDeleteOpen(false);
      onOpenChange(false);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className="mx-auto flex max-h-[min(92dvh,720px)] max-w-lg flex-col rounded-t-[1.75rem]">
          <DrawerHeader className="shrink-0">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1 text-left">
                <DrawerTitle>{initial ? "Artikel bearbeiten" : "Neuer Artikel"}</DrawerTitle>
                <DrawerDescription>
                  Für schnelles Übernehmen in Rechnungs-Positionen.
                </DrawerDescription>
              </div>
              {canDelete ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-destructive"
                  aria-label="Artikel löschen"
                  onClick={() => setConfirmDeleteOpen(true)}
                >
                  <Trash2 className="size-4" />
                </Button>
              ) : null}
            </div>
          </DrawerHeader>
          <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
              e.preventDefault();
              void (async () => {
                setSaving(true);
                try {
                  await onSave({
                    id: initial?.id,
                    name: name.trim(),
                    description: description.trim() || null,
                    default_unit_name: unitName,
                    default_unit_price: Number(price) || 0,
                    default_tax_rate_percent: Number(taxRate) || 0,
                    archived: !active,
                    recipe: normalizeRecipeDraft(recipeLines),
                  });
                  onOpenChange(false);
                } finally {
                  setSaving(false);
                }
              })();
            }}
          >
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                className={accountingFormControlClassName}
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label>Beschreibung</Label>
              <Input
                className={accountingFormControlClassName}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className={accountingFormGridClassName}>
              <div className="space-y-2">
                <Label>Einheit</Label>
                <SearchableSelect
                  value={unitName}
                  onValueChange={setUnitName}
                  options={unitOptions}
                  className={accountingFormSelectClassName}
                />
              </div>
              <div className="space-y-2">
                <Label>Steuersatz</Label>
                <SearchableSelect
                  value={taxRate}
                  onValueChange={setTaxRate}
                  options={taxOptions}
                  className={accountingFormSelectClassName}
                />
              </div>
              <div className="space-y-2">
                <Label>Preis</Label>
                <Input
                  className={accountingFormControlClassName}
                  type="number"
                  min={0}
                  step="0.01"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <Label>Aktiv</Label>
              <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-sm font-medium">Rezept (Bestand)</Label>
              <AccountingArticleRecipeEditor
                lines={recipeLines}
                onChange={setRecipeLines}
                ingredients={ingredients}
                stockUnits={stockUnits}
                disabled={saving || deleting}
              />
            </div>
            </div>
            <DrawerFormFooter
              className="px-4"
              onCancel={() => onOpenChange(false)}
              submitLabel="Speichern"
              submitPending={saving}
            />
          </form>
        </DrawerContent>
      </Drawer>

      {canDelete ? (
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Artikel wirklich löschen?"
          description={
            initial ? (
              <>
                „<span className="font-medium text-foreground">{initial.name}</span>“
                wird dauerhaft entfernt.
              </>
            ) : null
          }
          confirmLabel="Löschen"
          destructive
          confirmDisabled={deleting}
          onConfirm={() => void handleConfirmDelete()}
        />
      ) : null}
    </>
  );
}
