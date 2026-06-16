"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { CategoryDrawer } from "@/components/menu/category-drawer";
import {
  CategoriesManageDrawer,
  type ManageableListItem,
} from "@/components/menu/categories-manage-drawer";
import { Button } from "@/components/ui/button";
import {
  deleteAccountingCashCategory,
  fetchAccountingCashCategories,
  reorderAccountingCashCategories,
  saveAccountingCashCategory,
} from "@/lib/accounting/accounting-api";
import { ACCOUNTING_CASH_DIRECTION_LABELS } from "@/lib/accounting/accounting-cash-book-defaults";
import type {
  AccountingCashCategoryRow,
  AccountingCashDirection,
} from "@/lib/types/accounting-cash-book";

function categoryDeleteErrorMessage(code: string) {
  if (code === "category_in_use") {
    return "Art wird noch in Buchungen verwendet — stattdessen deaktivieren.";
  }
  return "Löschen fehlgeschlagen.";
}

export function AccountingCashCategoryToolbar({
  restaurantId,
  disabled,
  onRefresh,
}: {
  restaurantId: string;
  disabled?: boolean;
  onRefresh: () => void;
}) {
  const [incomeManageOpen, setIncomeManageOpen] = useState(false);
  const [expenseManageOpen, setExpenseManageOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [formDirection, setFormDirection] =
    useState<AccountingCashDirection>("income");
  const [editItem, setEditItem] = useState<ManageableListItem | null>(null);
  const [incomeCategories, setIncomeCategories] = useState<
    AccountingCashCategoryRow[]
  >([]);
  const [expenseCategories, setExpenseCategories] = useState<
    AccountingCashCategoryRow[]
  >([]);

  const loadCategories = useCallback(async () => {
    try {
      const [income, expense] = await Promise.all([
        fetchAccountingCashCategories(restaurantId, "income", {
          includeArchived: true,
        }),
        fetchAccountingCashCategories(restaurantId, "expense", {
          includeArchived: true,
        }),
      ]);
      setIncomeCategories(income);
      setExpenseCategories(expense);
    } catch {
      toast.error("Arten konnten nicht geladen werden.");
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!incomeManageOpen && !expenseManageOpen && !formOpen) return;
    void loadCategories();
  }, [incomeManageOpen, expenseManageOpen, formOpen, loadCategories]);

  const incomeItems = useMemo<ManageableListItem[]>(
    () =>
      incomeCategories.map((c) => ({
        id: c.id,
        name: c.name,
        active: !c.archived,
      })),
    [incomeCategories],
  );

  const expenseItems = useMemo<ManageableListItem[]>(
    () =>
      expenseCategories.map((c) => ({
        id: c.id,
        name: c.name,
        active: !c.archived,
      })),
    [expenseCategories],
  );

  const openForm = (
    direction: AccountingCashDirection,
    item?: ManageableListItem,
  ) => {
    setFormDirection(direction);
    setEditItem(item ?? null);
    setFormOpen(true);
  };

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
          onClick={() => setIncomeManageOpen(true)}
        >
          Einnahme-Arten
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          disabled={disabled}
          onClick={() => setExpenseManageOpen(true)}
        >
          Ausgabe-Arten
        </Button>
      </div>

      <CategoriesManageDrawer
        open={incomeManageOpen}
        onOpenChange={setIncomeManageOpen}
        categories={incomeItems}
        copy={{
          title: "Einnahme-Arten",
          description:
            "Kategorien für Bareinnahmen — Reihenfolge per Ziehen. Inaktive erscheinen nicht in Buchungen.",
          newButton: "Neue Einnahme-Art",
        }}
        onReorder={async (next) => {
          try {
            await reorderAccountingCashCategories(
              restaurantId,
              "income",
              next.map((n) => n.id),
            );
            await loadCategories();
            onRefresh();
          } catch {
            toast.error("Reihenfolge konnte nicht gespeichert werden.");
          }
        }}
        onEdit={(row) => openForm("income", row)}
        onNew={() => openForm("income")}
      />

      <CategoriesManageDrawer
        open={expenseManageOpen}
        onOpenChange={setExpenseManageOpen}
        categories={expenseItems}
        copy={{
          title: "Ausgabe-Arten",
          description:
            "Kategorien für Barausgaben — Reihenfolge per Ziehen. Inaktive erscheinen nicht in Buchungen.",
          newButton: "Neue Ausgabe-Art",
        }}
        onReorder={async (next) => {
          try {
            await reorderAccountingCashCategories(
              restaurantId,
              "expense",
              next.map((n) => n.id),
            );
            await loadCategories();
            onRefresh();
          } catch {
            toast.error("Reihenfolge konnte nicht gespeichert werden.");
          }
        }}
        onEdit={(row) => openForm("expense", row)}
        onNew={() => openForm("expense")}
      />

      <CategoryDrawer
        open={formOpen}
        onOpenChange={setFormOpen}
        mode={editItem ? "edit" : "create"}
        initial={
          editItem
            ? { id: editItem.id, name: editItem.name, active: editItem.active }
            : null
        }
        labels={{
          titleCreate: `Neue ${ACCOUNTING_CASH_DIRECTION_LABELS[formDirection]}-Art`,
          titleEdit: `${ACCOUNTING_CASH_DIRECTION_LABELS[formDirection]}-Art bearbeiten`,
          description: "Bezeichnung für Buchungen in der Kasse.",
          namePlaceholder:
            formDirection === "income" ? "z. B. Barverkauf" : "z. B. Wareneinkauf",
          activeDescription:
            "Inaktive Arten stehen bei neuen Buchungen nicht zur Auswahl.",
          deleteLabel: "Art löschen",
          deleteConfirmTitle: "Art wirklich löschen?",
        }}
        onSave={async (payload) => {
          try {
            await saveAccountingCashCategory(restaurantId, {
              id: payload.id,
              direction: formDirection,
              name: payload.name,
              archived: payload.active === false,
            });
            await loadCategories();
            onRefresh();
            toast.success("Art gespeichert.");
          } catch {
            toast.error("Art konnte nicht gespeichert werden.");
          }
        }}
        onDelete={
          editItem
            ? async (id) => {
                try {
                  await deleteAccountingCashCategory(restaurantId, id);
                  await loadCategories();
                  onRefresh();
                  toast.success("Art gelöscht.");
                } catch (e) {
                  toast.error(
                    categoryDeleteErrorMessage(
                      e instanceof Error ? e.message : "delete_failed",
                    ),
                  );
                }
              }
            : undefined
        }
      />
    </>
  );
}
