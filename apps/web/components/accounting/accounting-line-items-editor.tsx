"use client";

import { useCallback, useMemo } from "react";
import { GripVertical, Plus, Trash2 } from "lucide-react";
import { LineItemDescriptionField } from "@/components/accounting/line-item-description-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SearchableSelect } from "@/components/ui/combobox";
import { SortableDragOverlay } from "@/components/ui/sortable-drag-overlay";
import { computeLineAmount } from "@/lib/accounting/compute-line-totals";
import { createEmptyLineItem } from "@/lib/accounting/default-catalog";
import { useSortableReorder } from "@/lib/hooks/use-sortable-reorder";
import type {
  AccountingArticleRow,
  AccountingLineItem,
  AccountingTaxMode,
  AccountingTaxRateRow,
  AccountingUnitRow,
} from "@/lib/types/accounting";
import {
  accountingFormControlClassName,
  accountingFormSelectClassName,
  accountingLineItemGridClassName,
  accountingLineItemHeaderClassName,
} from "@/lib/ui/accounting-form-styles";
import { cn } from "@/lib/utils";

type AccountingLineItemsEditorProps = {
  items: AccountingLineItem[];
  taxMode: AccountingTaxMode;
  currency: string;
  units: AccountingUnitRow[];
  taxRates: AccountingTaxRateRow[];
  articles: AccountingArticleRow[];
  readOnly?: boolean;
  onChange: (items: AccountingLineItem[]) => void;
};

export function AccountingLineItemsEditor({
  items,
  taxMode,
  currency,
  units,
  taxRates,
  articles,
  readOnly,
  onChange,
}: AccountingLineItemsEditorProps) {
  const itemIds = useMemo(() => items.map((i) => i.id), [items]);

  const sort = useSortableReorder({
    itemIds,
    disabled: readOnly,
    onReorder: ({ fromIndex, toIndex }) => {
      const next = [...items];
      const [removed] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, removed);
      onChange(next.map((item, index) => ({ ...item, sortOrder: index })));
    },
  });

  const updateItem = useCallback(
    (id: string, patch: Partial<AccountingLineItem>) => {
      onChange(
        items.map((item) => {
          if (item.id !== id) return item;
          const merged = { ...item, ...patch };
          if (merged.type !== "text") {
            merged.lineAmount = computeLineAmount(merged, taxMode);
          }
          return merged;
        }),
      );
    },
    [items, onChange, taxMode],
  );

  const insertAt = (index: number) => {
    const next = [...items];
    next.splice(index, 0, createEmptyLineItem());
    onChange(next.map((item, i) => ({ ...item, sortOrder: i })));
  };

  const removeAt = (id: string) => {
    onChange(
      items
        .filter((item) => item.id !== id)
        .map((item, index) => ({ ...item, sortOrder: index })),
    );
  };

  const unitOptions = units.map((u) => ({ value: u.name, label: u.name }));
  const taxOptions = taxRates.map((t) => ({
    value: String(t.rate_percent),
    label: t.label,
  }));
  const applyArticle = useCallback(
    (itemId: string, article: AccountingArticleRow) => {
      updateItem(itemId, {
        type: "article",
        articleId: article.id,
        name: article.name,
        description: article.description,
        unitName: article.default_unit_name,
        unitPrice: article.default_unit_price,
        taxRatePercent: article.default_tax_rate_percent,
      });
    },
    [updateItem],
  );

  return (
    <div className="space-y-2">
      <div className={accountingLineItemHeaderClassName}>
        <span>Bezeichnung</span>
        <span>Steuersatz</span>
        <span>Menge</span>
        <span>Einheit</span>
        <span>Preis ({currency})</span>
      </div>

      {items.map((item, index) => {
        const handle = sort.getHandleProps(item.id);
        return (
          <div key={item.id} className="space-y-2">
            <div
              ref={(el) => sort.registerItemRef(item.id, el)}
              className={sort.getItemDropClassName(
                item.id,
                "rounded-xl border border-border/40 bg-card p-3",
              )}
            >
              <div className="flex gap-2">
                {!readOnly ? (
                  <button
                    type="button"
                    {...handle}
                    aria-label="Position verschieben"
                    className={cn(
                      "flex size-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/80",
                      handle.className,
                    )}
                  >
                    <GripVertical className="size-4" />
                  </button>
                ) : (
                  <div className="hidden size-11 shrink-0 sm:block" aria-hidden />
                )}
                <div className={accountingLineItemGridClassName}>
                  <LineItemDescriptionField
                    value={item.name}
                    readOnly={readOnly}
                    articles={articles}
                    onNameChange={(name) => updateItem(item.id, { name })}
                    onArticleSelect={(article) => applyArticle(item.id, article)}
                  />
                  {item.type !== "text" ? (
                    <>
                      <SearchableSelect
                        disabled={readOnly}
                        value={String(item.taxRatePercent)}
                        onValueChange={(v) =>
                          updateItem(item.id, {
                            taxRatePercent: Number(v),
                          })
                        }
                        options={taxOptions}
                        placeholder="Steuersatz"
                        className={accountingFormSelectClassName}
                      />
                      <Input
                        className={accountingFormControlClassName}
                        type="number"
                        min={0}
                        step="0.01"
                        readOnly={readOnly}
                        value={item.quantity}
                        onChange={(e) =>
                          updateItem(item.id, {
                            quantity: Number(e.target.value) || 0,
                          })
                        }
                      />
                      <SearchableSelect
                        disabled={readOnly}
                        value={item.unitName}
                        onValueChange={(v) =>
                          updateItem(item.id, { unitName: v })
                        }
                        options={unitOptions}
                        placeholder="Einheit"
                        className={accountingFormSelectClassName}
                      />
                      <Input
                        className={accountingFormControlClassName}
                        type="number"
                        min={0}
                        step="0.01"
                        readOnly={readOnly}
                        value={item.unitPrice}
                        onChange={(e) =>
                          updateItem(item.id, {
                            unitPrice: Number(e.target.value) || 0,
                          })
                        }
                        placeholder="Preis"
                      />
                    </>
                  ) : null}
                </div>
                {!readOnly ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-11 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => removeAt(item.id)}
                    aria-label="Position entfernen"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </div>
            </div>
            {!readOnly && index < items.length - 1 ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-dashed"
                onClick={() => insertAt(index + 1)}
              >
                <Plus className="size-4" />
                Position einfügen
              </Button>
            ) : null}
          </div>
        );
      })}
      {!readOnly ? (
        <Button
          type="button"
          variant="outline"
          className="w-full rounded-xl"
          onClick={() => insertAt(items.length)}
        >
          <Plus className="size-4" />
          Position hinzufügen
        </Button>
      ) : null}
      <SortableDragOverlay
        activeId={sort.activeId}
        dragLayout={sort.dragLayout}
        showGapLine={sort.wouldReorder}
        renderGhost={(id) => {
          const item = items.find((i) => i.id === id);
          if (!item) return null;
          return (
            <div className="px-3 py-2 text-sm font-medium">
              {item.name || "Position"}
            </div>
          );
        }}
      />
    </div>
  );
}
