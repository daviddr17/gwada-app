"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SearchableSelect } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_ACCOUNTING_TAX_RATES } from "@/lib/accounting/default-catalog";
import { parseEventPackageMoney } from "@/lib/events/event-package";
import {
  defaultEventMenuCourses,
  emptyEventMenuAddon,
  emptyEventMenuCourse,
  emptyEventMenuOption,
  EVENT_MENU_ADDON_BILLING_LABELS,
  EVENT_MENU_ADDON_BILLINGS,
  EVENT_MENU_COURSE_MODE_LABELS,
  EVENT_MENU_COURSE_MODES,
  EVENT_MENU_DIET_KEYS,
  EVENT_MENU_DIET_LABELS,
  EVENT_MENU_MAX_ADDONS,
  EVENT_MENU_MAX_COURSES,
  EVENT_MENU_MAX_OPTIONS_PER_COURSE,
  isEventMenuAddonBilling,
  isEventMenuCourseMode,
  type EventMenu,
  type EventMenuAddon,
  type EventMenuCourse,
  type EventMenuDietKey,
  type EventMenuWriteFields,
} from "@/lib/events/event-menu";
import { toast } from "sonner";
import { useDrawerFormSeed } from "@/lib/hooks/use-drawer-form-seed";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import { drawerFormHeaderClassName, drawerScrollAreaClassName } from "@/lib/ui/drawer-form-section";
import { cn } from "@/lib/utils";

const TAX_OPTIONS = DEFAULT_ACCOUNTING_TAX_RATES.map((rate) => ({
  value: String(rate.rate_percent),
  label: rate.label,
}));

const MODE_OPTIONS = EVENT_MENU_COURSE_MODES.map((mode) => ({
  value: mode,
  label: EVENT_MENU_COURSE_MODE_LABELS[mode],
}));

const BILLING_OPTIONS = EVENT_MENU_ADDON_BILLINGS.map((billing) => ({
  value: billing,
  label: EVENT_MENU_ADDON_BILLING_LABELS[billing],
}));

function cloneMenuCourses(menu: EventMenu | null): EventMenuCourse[] {
  if (!menu) return defaultEventMenuCourses();
  return menu.courses.map((course) => ({
    ...course,
    options: course.options.map((option) => ({ ...option, diets: [...option.diets] })),
  }));
}

function moneyField(value: number | null | undefined): string {
  if (value == null) return "";
  return String(value).replace(".", ",");
}

function DietToggles({
  value,
  onChange,
}: {
  value: EventMenuDietKey[];
  onChange: (next: EventMenuDietKey[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {EVENT_MENU_DIET_KEYS.map((diet) => {
        const on = value.includes(diet);
        return (
          <button
            key={diet}
            type="button"
            onClick={() =>
              onChange(on ? value.filter((item) => item !== diet) : [...value, diet])
            }
            className={cn(
              "rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors",
              on
                ? "border-accent bg-accent/15 text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-muted/50",
            )}
          >
            {EVENT_MENU_DIET_LABELS[diet]}
          </button>
        );
      })}
    </div>
  );
}

export function EventMenuDrawer({
  open,
  onOpenChange,
  pending = false,
  menu,
  onSave,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pending?: boolean;
  menu: EventMenu | null;
  onSave: (input: EventMenuWriteFields) => void;
  onDelete?: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [kidsPrice, setKidsPrice] = useState("");
  const [taxRate, setTaxRate] = useState("19");
  const [minParty, setMinParty] = useState("1");
  const [maxParty, setMaxParty] = useState("");
  const [active, setActive] = useState(true);
  const [courses, setCourses] = useState<EventMenuCourse[]>([]);
  const [addons, setAddons] = useState<EventMenuAddon[]>([]);

  useDrawerFormSeed(open, menu?.id ?? "__create__", () => {
    setName(menu?.name ?? "");
    setDescription(menu?.description ?? "");
    setPrice(menu ? moneyField(menu.pricePerPerson) : "");
    setKidsPrice(menu ? moneyField(menu.kidsPricePerPerson) : "");
    setTaxRate(String(menu?.taxRatePercent ?? 19).replace(/\.0+$/, ""));
    setMinParty(String(menu?.minPartySize ?? 1));
    setMaxParty(menu?.maxPartySize != null ? String(menu.maxPartySize) : "");
    setActive(menu?.active ?? true);
    setCourses(cloneMenuCourses(menu));
    setAddons(menu?.addons.map((addon) => ({ ...addon })) ?? []);
  });

  const updateCourse = (courseId: string, patch: Partial<EventMenuCourse>) => {
    setCourses((prev) =>
      prev.map((course) => (course.id === courseId ? { ...course, ...patch } : course)),
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || pending) return;
    const pricePerPerson = parseEventPackageMoney(price);
    if (pricePerPerson < 0 || pricePerPerson > 9999.99) {
      toast.error("Bitte einen gültigen Preis pro Person eingeben.");
      return;
    }
    const kidsTrimmed = kidsPrice.trim();
    const kidsPricePerPerson = kidsTrimmed
      ? parseEventPackageMoney(kidsTrimmed)
      : null;
    if (
      kidsPricePerPerson != null &&
      (kidsPricePerPerson < 0 || kidsPricePerPerson > 9999.99)
    ) {
      toast.error("Bitte einen gültigen Kinderpreis eingeben.");
      return;
    }
    const minPartySize = Math.min(200, Math.max(1, Number.parseInt(minParty, 10) || 1));
    const maxParsed = maxParty.trim() ? Number.parseInt(maxParty, 10) : null;
    const maxPartySize =
      maxParsed != null && Number.isFinite(maxParsed) ? maxParsed : null;
    if (maxPartySize != null && maxPartySize < minPartySize) {
      toast.error("Maximale Personenanzahl muss mindestens so groß sein wie die minimale.");
      return;
    }

    const cleanedCourses = courses
      .map((course, courseIndex) => ({
        ...course,
        name: course.name.trim(),
        sortOrder: courseIndex,
        options: course.options
          .map((option, optionIndex) => ({
            ...option,
            name: option.name.trim(),
            description: option.description.trim(),
            sortOrder: optionIndex,
          }))
          .filter((option) => option.name.length > 0),
      }))
      .filter((course) => course.name.length > 0);

    const cleanedAddons = addons
      .map((addon, index) => ({
        ...addon,
        name: addon.name.trim(),
        description: addon.description.trim(),
        sortOrder: index,
      }))
      .filter((addon) => addon.name.length > 0);

    onSave({
      name: trimmed,
      description: description.trim(),
      pricePerPerson,
      kidsPricePerPerson,
      taxRatePercent: parseEventPackageMoney(taxRate),
      minPartySize,
      maxPartySize,
      active,
      sortOrder: menu?.sortOrder ?? 0,
      courses: cleanedCourses,
      addons: cleanedAddons,
    });
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(next) => {
        if (pending) return;
        onOpenChange(next);
      }}
      direction="bottom"
      repositionInputs={false}
    >
      <DrawerContent className={drawerContentClassName("mediaTall")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            {menu ? "Menü bearbeiten" : "Neues Menü"}
          </DrawerTitle>
          <DrawerDescription className="text-base">
            Gäste wählen dieses Menü und verteilen Personen auf die Gerichte —
            inkl. Aufpreise und Optionen.
          </DrawerDescription>
        </DrawerHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className={drawerScrollAreaClassName(6)}>
            <DrawerFormSection title="Menü">
              <div className="space-y-2">
                <Label htmlFor="event-menu-name">Name</Label>
                <Input
                  id="event-menu-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="z. B. Menü Classic"
                  maxLength={120}
                  className="h-12 rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-menu-description">Beschreibung</Label>
                <Textarea
                  id="event-menu-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  maxLength={800}
                  placeholder="Kurz, was das Menü ausmacht"
                  className="min-h-[4.5rem] resize-y rounded-xl"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="event-menu-price">Preis / Person</Label>
                  <Input
                    id="event-menu-price"
                    inputMode="decimal"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="42,00"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-menu-kids-price">Kinderpreis / Person</Label>
                  <Input
                    id="event-menu-kids-price"
                    inputMode="decimal"
                    value={kidsPrice}
                    onChange={(e) => setKidsPrice(e.target.value)}
                    placeholder="wie Erwachsene"
                    className="h-12 rounded-xl"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="event-menu-min">Min. Personen</Label>
                  <Input
                    id="event-menu-min"
                    inputMode="numeric"
                    value={minParty}
                    onChange={(e) => setMinParty(e.target.value)}
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-menu-max">Max. Personen</Label>
                  <Input
                    id="event-menu-max"
                    inputMode="numeric"
                    value={maxParty}
                    onChange={(e) => setMaxParty(e.target.value)}
                    placeholder="ohne Limit"
                    className="h-12 rounded-xl"
                  />
                </div>
                <div className="space-y-2 col-span-2 sm:col-span-1">
                  <Label htmlFor="event-menu-tax">MwSt.</Label>
                  <SearchableSelect
                    id="event-menu-tax"
                    value={taxRate}
                    onValueChange={(value) => {
                      if (value) setTaxRate(value);
                    }}
                    options={TAX_OPTIONS}
                    className="min-h-12 rounded-xl"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between gap-3">
                <Label htmlFor="event-menu-active">Im Formular anzeigen</Label>
                <Switch
                  id="event-menu-active"
                  checked={active}
                  onCheckedChange={(checked) => setActive(checked === true)}
                />
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Gänge">
              <p className="text-xs text-muted-foreground">
                „Gäste wählen nach Personen“ = z. B. 30× Fleisch, 10× vegetarisch.
                „Für alle inklusive“ listet Gerichte nur als Inhalt.
              </p>
              <div className="space-y-3">
                {courses.map((course) => (
                  <div
                    key={course.id}
                    className="space-y-3 rounded-xl border border-border/50 bg-muted/15 p-3"
                  >
                    <div className="flex items-start gap-2">
                      <Input
                        value={course.name}
                        onChange={(e) => updateCourse(course.id, { name: e.target.value })}
                        placeholder="Gang"
                        maxLength={80}
                        className="h-10 rounded-xl"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-0.5 shrink-0 rounded-full"
                        onClick={() =>
                          setCourses((prev) => prev.filter((item) => item.id !== course.id))
                        }
                        aria-label="Gang entfernen"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <SearchableSelect
                      value={course.selectionMode}
                      onValueChange={(value) => {
                        if (isEventMenuCourseMode(value)) {
                          updateCourse(course.id, { selectionMode: value });
                        }
                      }}
                      options={MODE_OPTIONS}
                      className="min-h-10 rounded-xl"
                    />
                    {course.selectionMode === "split" ? (
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs">Alle Gäste müssen wählen</Label>
                        <Switch
                          checked={course.required}
                          onCheckedChange={(checked) =>
                            updateCourse(course.id, { required: checked === true })
                          }
                        />
                      </div>
                    ) : null}
                    <div className="space-y-2">
                      {course.options.map((option, optionIndex) => (
                        <div
                          key={option.id}
                          className="space-y-2 rounded-lg border border-border/40 bg-background/70 p-2.5"
                        >
                          <div className="flex gap-2">
                            <Input
                              value={option.name}
                              onChange={(e) =>
                                updateCourse(course.id, {
                                  options: course.options.map((item) =>
                                    item.id === option.id
                                      ? { ...item, name: e.target.value }
                                      : item,
                                  ),
                                })
                              }
                              placeholder="Gericht"
                              maxLength={120}
                              className="h-10 rounded-xl"
                            />
                            <Input
                              inputMode="decimal"
                              value={
                                option.extraPricePerPerson
                                  ? moneyField(option.extraPricePerPerson)
                                  : ""
                              }
                              onChange={(e) =>
                                updateCourse(course.id, {
                                  options: course.options.map((item) =>
                                    item.id === option.id
                                      ? {
                                          ...item,
                                          extraPricePerPerson: parseEventPackageMoney(
                                            e.target.value,
                                          ),
                                        }
                                      : item,
                                  ),
                                })
                              }
                              placeholder="+ €"
                              className="h-10 w-[5.5rem] shrink-0 rounded-xl"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="mt-0.5 shrink-0 rounded-full"
                              onClick={() =>
                                updateCourse(course.id, {
                                  options: course.options.filter((item) => item.id !== option.id),
                                })
                              }
                              aria-label="Gericht entfernen"
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          </div>
                          <Input
                            value={option.description}
                            onChange={(e) =>
                              updateCourse(course.id, {
                                options: course.options.map((item) =>
                                  item.id === option.id
                                    ? { ...item, description: e.target.value }
                                    : item,
                                ),
                              })
                            }
                            placeholder="Kurzbeschreibung (optional)"
                            maxLength={400}
                            className="h-9 rounded-xl text-sm"
                          />
                          <DietToggles
                            value={option.diets}
                            onChange={(diets) =>
                              updateCourse(course.id, {
                                options: course.options.map((item, index) =>
                                  index === optionIndex ? { ...item, diets } : item,
                                ),
                              })
                            }
                          />
                        </div>
                      ))}
                      {course.options.length < EVENT_MENU_MAX_OPTIONS_PER_COURSE ? (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="w-full rounded-xl"
                          onClick={() =>
                            updateCourse(course.id, {
                              options: [...course.options, emptyEventMenuOption()],
                            })
                          }
                        >
                          <Plus className="size-3.5" />
                          Gericht
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
                {courses.length < EVENT_MENU_MAX_COURSES ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() =>
                      setCourses((prev) => [...prev, emptyEventMenuCourse(`Gang ${prev.length + 1}`)])
                    }
                  >
                    <Plus className="size-4" />
                    Gang hinzufügen
                  </Button>
                ) : null}
              </div>
            </DrawerFormSection>

            <DrawerFormSection title="Optionen">
              <p className="text-xs text-muted-foreground">
                Weinbegleitung, Käseteller, Dekoration — Gäste setzen die Anzahl
                selbst. „Ohne Kinder“ rechnet Wein z. B. nur für Erwachsene.
              </p>
              <div className="space-y-2">
                {addons.map((addon) => (
                  <div
                    key={addon.id}
                    className="space-y-2 rounded-xl border border-border/50 bg-muted/15 p-3"
                  >
                    <div className="flex gap-2">
                      <Input
                        value={addon.name}
                        onChange={(e) =>
                          setAddons((prev) =>
                            prev.map((item) =>
                              item.id === addon.id ? { ...item, name: e.target.value } : item,
                            ),
                          )
                        }
                        placeholder="z. B. Weinbegleitung"
                        maxLength={120}
                        className="h-10 rounded-xl"
                      />
                      <Input
                        inputMode="decimal"
                        value={addon.price ? moneyField(addon.price) : ""}
                        onChange={(e) =>
                          setAddons((prev) =>
                            prev.map((item) =>
                              item.id === addon.id
                                ? { ...item, price: parseEventPackageMoney(e.target.value) }
                                : item,
                            ),
                          )
                        }
                        placeholder="€"
                        className="h-10 w-[5.5rem] shrink-0 rounded-xl"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="mt-0.5 shrink-0 rounded-full"
                        onClick={() =>
                          setAddons((prev) => prev.filter((item) => item.id !== addon.id))
                        }
                        aria-label="Option entfernen"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                    <Input
                      value={addon.description}
                      onChange={(e) =>
                        setAddons((prev) =>
                          prev.map((item) =>
                            item.id === addon.id
                              ? { ...item, description: e.target.value }
                              : item,
                          ),
                        )
                      }
                      placeholder="Kurzbeschreibung (optional)"
                      maxLength={400}
                      className="h-9 rounded-xl text-sm"
                    />
                    <SearchableSelect
                      value={addon.billing}
                      onValueChange={(value) => {
                        if (!isEventMenuAddonBilling(value)) return;
                        setAddons((prev) =>
                          prev.map((item) =>
                            item.id === addon.id ? { ...item, billing: value } : item,
                          ),
                        );
                      }}
                      options={BILLING_OPTIONS}
                      className="min-h-10 rounded-xl"
                    />
                    {addon.billing === "per_person" ? (
                      <div className="flex items-center justify-between gap-3">
                        <Label className="text-xs">Nicht für Kinder</Label>
                        <Switch
                          checked={addon.excludeKids}
                          onCheckedChange={(checked) =>
                            setAddons((prev) =>
                              prev.map((item) =>
                                item.id === addon.id
                                  ? { ...item, excludeKids: checked === true }
                                  : item,
                              ),
                            )
                          }
                        />
                      </div>
                    ) : null}
                  </div>
                ))}
                {addons.length < EVENT_MENU_MAX_ADDONS ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-xl"
                    onClick={() => setAddons((prev) => [...prev, emptyEventMenuAddon()])}
                  >
                    <Plus className="size-4" />
                    Option hinzufügen
                  </Button>
                ) : null}
              </div>
            </DrawerFormSection>
          </div>

          <DrawerFormFooter
            onCancel={() => onOpenChange(false)}
            submitPending={pending}
            submitDisabled={!name.trim()}
            showDelete={Boolean(menu && onDelete)}
            onDelete={onDelete}
            deleteLabel="Löschen"
          />
        </form>
      </DrawerContent>
    </Drawer>
  );
}
