"use client";

import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
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
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { staffDrawerFieldClassName } from "@/components/staff/staff-form-field-styles";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import type { MenuOptionGroupSaveInput } from "@/lib/supabase/menu-db";
import type { MenuOptionGroup } from "@/lib/types/menu";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { formatEuroAmount } from "@/lib/menu/recipe-cost-utils";
import { cn } from "@/lib/utils";

const SELECTION_ITEMS = {
  single: "Eine Position",
  multiple: "Mehrere Positionen",
} as const;

type ChoiceDraft = {
  key: string;
  id?: string;
  name: string;
  price: string;
  active: boolean;
};

type FormState = {
  name: string;
  active: boolean;
  /** single = max 1; multiple = beliebig */
  selection: "single" | "multiple";
  required: boolean;
  choices: ChoiceDraft[];
};

function emptyChoice(): ChoiceDraft {
  return {
    key: crypto.randomUUID(),
    name: "",
    price: "",
    active: true,
  };
}

function groupToForm(group: MenuOptionGroup | null | undefined): FormState {
  if (!group) {
    return {
      name: "",
      active: true,
      selection: "single",
      required: false,
      choices: [emptyChoice()],
    };
  }
  return {
    name: group.name,
    active: group.active !== false,
    selection: group.maxSelect === 1 ? "single" : "multiple",
    required: (group.minSelect ?? 0) >= 1,
    choices:
      group.choices.length > 0
        ? group.choices.map((c) => ({
            key: c.id,
            id: c.id,
            name: c.name,
            price:
              c.priceDelta > 0
                ? String(c.priceDelta).replace(".", ",")
                : "",
            active: c.active !== false,
          }))
        : [emptyChoice()],
  };
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initial?: MenuOptionGroup | null;
  onSave: (payload: MenuOptionGroupSaveInput) => void | Promise<void>;
  onDelete?: (id: string) => void | Promise<void>;
};

function OptionSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
}: {
  title: string;
  description: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

export function MenuOptionGroupDrawer({
  open,
  onOpenChange,
  mode,
  initial,
  onSave,
  onDelete,
}: Props) {
  const [form, setForm] = useState<FormState>(() => groupToForm(initial));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [deleteOpen, setDeleteOpen] = useState(false);

  useDrawerFormSeed(open, initial?.id ?? "__new_option__", () => {
    setForm(groupToForm(mode === "edit" ? initial : null));
    setErrors({});
    setDeleteOpen(false);
  });

  const choicePreview = useMemo(
    () =>
      form.choices
        .filter((c) => c.name.trim())
        .map((c) => {
          const n = Number.parseFloat(c.price.replace(",", "."));
          const delta = Number.isFinite(n) && n > 0 ? n : 0;
          return delta > 0
            ? `${c.name.trim()} (+${formatEuroAmount(delta)})`
            : c.name.trim();
        })
        .join(" · "),
    [form.choices],
  );

  const validate = (): MenuOptionGroupSaveInput | null => {
    const next: Record<string, string> = {};
    if (!form.name.trim()) next.name = "Name ist erforderlich";
    const choices = form.choices
      .map((c) => {
        const name = c.name.trim();
        if (!name) return null;
        const raw = c.price.trim().replace(",", ".");
        const priceDelta = raw === "" ? 0 : Number.parseFloat(raw);
        if (Number.isNaN(priceDelta) || priceDelta < 0) {
          next[`choice_${c.key}`] = "Preis ≥ 0 oder leer";
          return null;
        }
        return {
          id: c.id,
          name,
          priceDelta,
          active: c.active,
        };
      })
      .filter((c): c is NonNullable<typeof c> => c != null);

    if (choices.length === 0) {
      next.choices = "Mindestens eine Position anlegen";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return {
      name: form.name.trim(),
      active: form.active,
      minSelect: form.required ? 1 : 0,
      maxSelect: form.selection === "single" ? 1 : null,
      choices,
    };
  };

  const handleSubmit = async () => {
    const payload = validate();
    if (!payload) return;
    await onSave(payload);
    onOpenChange(false);
  };

  const updateChoice = (index: number, patch: Partial<ChoiceDraft>) => {
    setForm((p) => {
      const choices = [...p.choices];
      choices[index] = { ...choices[index]!, ...patch };
      return { ...p, choices };
    });
  };

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("taxonomy")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle>
              {mode === "create" ? "Neue Option" : "Option bearbeiten"}
            </DrawerTitle>
            <DrawerDescription>
              Gruppe mit wählbaren Positionen (z. B. Beilagen). Aufpreis je
              Position optional.
            </DrawerDescription>
          </DrawerHeader>

          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Allgemein">
              <div className="space-y-2">
                <Label htmlFor="option-name">Name</Label>
                <Input
                  id="option-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="z. B. Beilagen"
                  className={staffDrawerFieldClassName}
                />
                {errors.name ? (
                  <p className="text-xs text-destructive">{errors.name}</p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="option-selection">Auswahl</Label>
                <Select
                  value={form.selection}
                  items={SELECTION_ITEMS}
                  onValueChange={(v) =>
                    setForm((p) => ({
                      ...p,
                      selection:
                        String(v) === "multiple" ? "multiple" : "single",
                    }))
                  }
                >
                  <SelectTrigger
                    id="option-selection"
                    className={appSelectTriggerAccentCn(staffDrawerFieldClassName)}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="single">
                      {SELECTION_ITEMS.single}
                    </SelectItem>
                    <SelectItem value="multiple">
                      {SELECTION_ITEMS.multiple}
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {form.selection === "single"
                    ? "Gäste wählen genau eine Position."
                    : "Gäste können mehrere Positionen kombinieren."}
                </p>
              </div>

              <OptionSwitchRow
                title="Aktiv"
                description="Inaktive Optionen stehen bei Gerichten nicht zur Auswahl."
                checked={form.active}
                onCheckedChange={(active) =>
                  setForm((p) => ({ ...p, active }))
                }
              />
              <OptionSwitchRow
                title="Pflicht"
                description="Mindestens eine Wahl ist nötig."
                checked={form.required}
                onCheckedChange={(required) =>
                  setForm((p) => ({ ...p, required }))
                }
              />
            </DrawerFormSection>

            <DrawerFormSection title="Positionen">
              <p className="text-xs text-muted-foreground">
                Jede Zeile ist eine wählbare Variante. Aufpreis leer = ohne
                Aufpreis.
              </p>
              {errors.choices ? (
                <p className="text-xs text-destructive">{errors.choices}</p>
              ) : null}

              <ul className="space-y-3">
                {form.choices.map((c, i) => (
                  <li
                    key={c.key}
                    className="space-y-3 rounded-xl border border-border/50 bg-muted/10 p-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-muted-foreground">
                        Position {i + 1}
                      </p>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="size-8 text-muted-foreground hover:text-destructive"
                        aria-label={`Position ${i + 1} entfernen`}
                        onClick={() =>
                          setForm((p) => ({
                            ...p,
                            choices:
                              p.choices.length <= 1
                                ? [emptyChoice()]
                                : p.choices.filter((_, j) => j !== i),
                          }))
                        }
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`option-choice-name-${c.key}`}>Name</Label>
                      <Input
                        id={`option-choice-name-${c.key}`}
                        value={c.name}
                        onChange={(e) =>
                          updateChoice(i, { name: e.target.value })
                        }
                        placeholder="z. B. Pommes"
                        className={staffDrawerFieldClassName}
                      />
                    </div>

                    <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                      <div className="space-y-2">
                        <Label htmlFor={`option-choice-price-${c.key}`}>
                          Aufpreis (€)
                        </Label>
                        <Input
                          id={`option-choice-price-${c.key}`}
                          value={c.price}
                          onChange={(e) =>
                            updateChoice(i, { price: e.target.value })
                          }
                          placeholder="0"
                          inputMode="decimal"
                          className={cn(
                            staffDrawerFieldClassName,
                            "tabular-nums",
                          )}
                        />
                        {errors[`choice_${c.key}`] ? (
                          <p className="text-xs text-destructive">
                            {errors[`choice_${c.key}`]}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-border/50 px-3 sm:min-w-[8.5rem]">
                        <span className="text-sm font-medium">Aktiv</span>
                        <Switch
                          checked={c.active}
                          onCheckedChange={(active) =>
                            updateChoice(i, { active })
                          }
                        />
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <Button
                type="button"
                variant="outline"
                size="lg"
                className="w-full rounded-xl"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    choices: [...p.choices, emptyChoice()],
                  }))
                }
              >
                <Plus className="size-4" />
                Position hinzufügen
              </Button>

              {choicePreview ? (
                <div className="rounded-xl border border-border/40 bg-background/80 px-3 py-2.5">
                  <p className="text-xs font-medium text-muted-foreground">
                    Vorschau
                  </p>
                  <p className="mt-0.5 text-sm text-foreground">{choicePreview}</p>
                </div>
              ) : null}
            </DrawerFormSection>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitType="button"
            submitLabel="Speichern"
            onSubmit={() => void handleSubmit()}
            showDelete={mode === "edit" && Boolean(initial && onDelete)}
            deleteLabel="Löschen"
            onDelete={() => setDeleteOpen(true)}
          />
        </DrawerContent>
      </Drawer>

      {mode === "edit" && initial && onDelete ? (
        <ConfirmDialog
          open={deleteOpen}
          onOpenChange={setDeleteOpen}
          title="Option löschen?"
          description={`„${initial.name}“ wird von allen Gerichten entfernt.`}
          confirmLabel="Löschen"
          destructive
          onConfirm={() => {
            void onDelete(initial.id);
            setDeleteOpen(false);
            onOpenChange(false);
          }}
        />
      ) : null}
    </>
  );
}
