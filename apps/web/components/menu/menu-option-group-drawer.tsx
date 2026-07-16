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
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import type { MenuOptionGroupSaveInput } from "@/lib/supabase/menu-db";
import type { MenuOptionGroup } from "@/lib/types/menu";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";
import { formatEuroAmount } from "@/lib/menu/recipe-cost-utils";

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
        const priceDelta =
          raw === "" ? 0 : Number.parseFloat(raw);
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

  return (
    <>
      <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
        <DrawerContent className={drawerContentClassName("taxonomy")}>
          <DrawerHeader className={drawerFormHeaderClassName(6)}>
            <DrawerTitle>
              {mode === "create" ? "Neue Option" : "Option bearbeiten"}
            </DrawerTitle>
            <DrawerDescription>
              Gruppe mit wählbaren Positionen (z. B. Beilagen). Preis je Position
              optional als Aufpreis.
            </DrawerDescription>
          </DrawerHeader>

          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Allgemein">
              <div className="space-y-2">
                <Label htmlFor="option-name" className="text-xs text-muted-foreground">
                  Name
                </Label>
                <Input
                  id="option-name"
                  value={form.name}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder="z. B. Beilagen"
                  className="h-12 rounded-xl"
                />
                {errors.name ? (
                  <p className="text-xs text-destructive">{errors.name}</p>
                ) : null}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
                <div>
                  <p className="text-sm font-medium">Aktiv</p>
                  <p className="text-xs text-muted-foreground">
                    Inaktive Optionen stehen bei Gerichten nicht zur Auswahl.
                  </p>
                </div>
                <Switch
                  checked={form.active}
                  onCheckedChange={(active) =>
                    setForm((p) => ({ ...p, active }))
                  }
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Auswahl</Label>
                  <Select
                    value={form.selection}
                    onValueChange={(v) =>
                      setForm((p) => ({
                        ...p,
                        selection:
                          String(v) === "multiple" ? "multiple" : "single",
                      }))
                    }
                  >
                    <SelectTrigger
                      className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="single">Eine Position</SelectItem>
                      <SelectItem value="multiple">Mehrere Positionen</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5">
                  <div>
                    <p className="text-sm font-medium">Pflicht</p>
                    <p className="text-xs text-muted-foreground">
                      Mindestens eine Wahl nötig
                    </p>
                  </div>
                  <Switch
                    checked={form.required}
                    onCheckedChange={(required) =>
                      setForm((p) => ({ ...p, required }))
                    }
                  />
                </div>
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Positionen">
              {errors.choices ? (
                <p className="text-xs text-destructive">{errors.choices}</p>
              ) : null}
              <div className="overflow-x-auto rounded-lg border border-border/50 bg-muted/10">
                <table className="w-full min-w-[280px] text-sm">
                  <thead>
                    <tr className={moduleDataTableHeadRowMutedClassName}>
                      <th className="px-2 py-1.5 text-left font-medium">Name</th>
                      <th className="w-28 px-2 py-1.5 text-left font-medium">
                        Aufpreis
                      </th>
                      <th className="w-16 px-1 py-1.5 text-center font-medium">
                        Aktiv
                      </th>
                      <th className="w-10 px-1 py-1.5" />
                    </tr>
                  </thead>
                  <tbody>
                    {form.choices.map((c, i) => (
                      <tr
                        key={c.key}
                        className="border-b border-border/35 last:border-b-0"
                      >
                        <td className="p-1">
                          <Input
                            value={c.name}
                            onChange={(e) =>
                              setForm((p) => {
                                const choices = [...p.choices];
                                choices[i] = {
                                  ...choices[i]!,
                                  name: e.target.value,
                                };
                                return { ...p, choices };
                              })
                            }
                            placeholder="z. B. Pommes"
                            className="h-9 rounded-lg"
                          />
                        </td>
                        <td className="p-1">
                          <Input
                            value={c.price}
                            onChange={(e) =>
                              setForm((p) => {
                                const choices = [...p.choices];
                                choices[i] = {
                                  ...choices[i]!,
                                  price: e.target.value,
                                };
                                return { ...p, choices };
                              })
                            }
                            placeholder="0"
                            inputMode="decimal"
                            className="h-9 rounded-lg"
                          />
                          {errors[`choice_${c.key}`] ? (
                            <p className="mt-0.5 text-[11px] text-destructive">
                              {errors[`choice_${c.key}`]}
                            </p>
                          ) : null}
                        </td>
                        <td className="p-1 text-center">
                          <Switch
                            checked={c.active}
                            onCheckedChange={(active) =>
                              setForm((p) => {
                                const choices = [...p.choices];
                                choices[i] = { ...choices[i]!, active };
                                return { ...p, choices };
                              })
                            }
                          />
                        </td>
                        <td className="p-1 text-center">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Position entfernen"
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
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-xl"
                onClick={() =>
                  setForm((p) => ({
                    ...p,
                    choices: [...p.choices, emptyChoice()],
                  }))
                }
              >
                <Plus className="size-4" />
                Position
              </Button>
              {choicePreview ? (
                <p className="text-xs text-muted-foreground">{choicePreview}</p>
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
