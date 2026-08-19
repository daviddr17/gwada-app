"use client";

import { useMemo } from "react";
import {
  clampAddonCount,
  clampEventMenuWishes,
  courseAssignedCount,
  EMPTY_EVENT_MENU_SELECTION,
  EVENT_MENU_DIET_KEYS,
  eventMenuEstimateTotal,
  eventMenuFitsPartySize,
  eventMenuPartyRangeLabel,
  findEventMenuCourseIssues,
  findEventMenuWishWarnings,
  suggestSplitCourseCounts,
  type EventMenuDietKey,
  type EventMenuSelection,
  type EventMenuWishes,
  type PublicEventMenu,
} from "@/lib/events/event-menu";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import { cn } from "@/lib/utils";

const choiceClassName =
  "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors";

export type EventInquiryMenuLabels = {
  title: string;
  hint: string;
  none: string;
  perPerson: (price: string) => string;
  kidsPrice: (price: string) => string;
  partyRange: (range: string) => string;
  tooFew: (min: number) => string;
  tooMany: (max: number) => string;
  wishesTitle: string;
  wishesHint: string;
  diet: Record<EventMenuDietKey, string>;
  coursesTitle: string;
  included: string;
  assigned: (assigned: number, expected: number) => string;
  extraPrice: (price: string) => string;
  addonsTitle: string;
  addonPerPerson: string;
  addonFlat: string;
  addonExcludeKids: string;
  wishWarning: (diet: string) => string;
};

function MenuChoiceButton({
  selected,
  title,
  description,
  meta,
  priceLabel,
  disabled,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description?: string;
  meta?: string;
  priceLabel?: string;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        choiceClassName,
        disabled && "opacity-60",
        selected
          ? "border-accent bg-accent/20"
          : "border-border/50 bg-transparent hover:border-border hover:bg-muted/40",
      )}
    >
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{description}</span>
        ) : null}
        {meta ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">{meta}</span>
        ) : null}
      </span>
      {priceLabel ? (
        <span className="shrink-0 text-right text-xs tabular-nums text-muted-foreground sm:text-sm">
          {priceLabel}
        </span>
      ) : null}
    </button>
  );
}

function CountInput({
  value,
  max,
  onChange,
  ariaLabel,
}: {
  value: number;
  max: number;
  onChange: (next: number) => void;
  ariaLabel: string;
}) {
  return (
    <input
      type="number"
      min={0}
      max={max}
      value={value || ""}
      aria-label={ariaLabel}
      onChange={(e) => {
        const n = Number.parseInt(e.target.value, 10);
        onChange(Number.isFinite(n) ? Math.min(max, Math.max(0, n)) : 0);
      }}
      className="h-9 w-16 shrink-0 rounded-lg border border-input bg-background px-2 text-right text-sm tabular-nums"
    />
  );
}

export function selectionWithMenu(
  menus: PublicEventMenu[],
  menuId: string | null,
  partySize: number,
  wishes: EventMenuWishes,
  previous?: EventMenuSelection,
): EventMenuSelection {
  const clamped = clampEventMenuWishes(wishes, partySize);
  if (!menuId) {
    return { ...EMPTY_EVENT_MENU_SELECTION, wishes: clamped };
  }
  const menu = menus.find((item) => item.id === menuId);
  if (!menu || !eventMenuFitsPartySize(menu, partySize)) {
    return { ...EMPTY_EVENT_MENU_SELECTION, wishes: clamped };
  }
  const sameMenu = previous?.menuId === menuId;
  const courseCounts: Record<string, Record<string, number>> = {};
  for (const course of menu.courses) {
    if (course.selectionMode !== "split") continue;
    const existing = sameMenu ? previous?.courseCounts[course.id] : undefined;
    const hasExisting =
      existing && Object.values(existing).some((count) => count > 0);
    courseCounts[course.id] = hasExisting
      ? existing
      : suggestSplitCourseCounts(course, partySize, clamped);
  }
  const addonCounts: Record<string, number> = {};
  if (sameMenu) {
    for (const addon of menu.addons) {
      addonCounts[addon.id] = clampAddonCount(
        addon,
        previous?.addonCounts[addon.id] ?? 0,
        partySize,
        clamped,
      );
    }
  }
  return { menuId, courseCounts, addonCounts, wishes: clamped };
}

export function EmbedEventInquiryMenus({
  menus,
  partySize,
  selection,
  onSelectionChange,
  labels,
}: {
  menus: PublicEventMenu[];
  partySize: number;
  selection: EventMenuSelection;
  onSelectionChange: (next: EventMenuSelection) => void;
  labels: EventInquiryMenuLabels;
}) {
  const selectedMenu = useMemo(
    () => menus.find((menu) => menu.id === selection.menuId) ?? null,
    [menus, selection.menuId],
  );
  const issues = selectedMenu
    ? findEventMenuCourseIssues(selectedMenu, selection, partySize)
    : [];
  const wishWarnings = selectedMenu
    ? findEventMenuWishWarnings(selectedMenu, selection)
    : [];
  const estimate = selectedMenu
    ? eventMenuEstimateTotal(selectedMenu, selection, partySize)
    : 0;

  if (menus.length === 0) return null;

  const setWishes = (patch: Partial<EventMenuWishes>) => {
    const wishes = clampEventMenuWishes(
      { ...selection.wishes, ...patch },
      partySize,
    );
    onSelectionChange(
      selectionWithMenu(menus, selection.menuId, partySize, wishes, {
        ...selection,
        wishes,
      }),
    );
  };

  const setCourseCount = (courseId: string, optionId: string, count: number) => {
    onSelectionChange({
      ...selection,
      courseCounts: {
        ...selection.courseCounts,
        [courseId]: {
          ...(selection.courseCounts[courseId] ?? {}),
          [optionId]: count,
        },
      },
    });
  };

  const setAddonCount = (addonId: string, count: number) => {
    onSelectionChange({
      ...selection,
      addonCounts: { ...selection.addonCounts, [addonId]: count },
    });
  };

  return (
    <div className="space-y-4 rounded-xl border border-border/50 bg-muted/20 p-3">
      <div className="space-y-1">
        <p className="text-sm font-medium" data-embed-mt>
          {labels.title}
        </p>
        <p className="text-xs text-muted-foreground" data-embed-mt>
          {labels.hint}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-medium sm:text-sm">{labels.wishesTitle}</p>
        <p className="text-xs text-muted-foreground">{labels.wishesHint}</p>
        <div className="grid grid-cols-2 gap-2">
          {EVENT_MENU_DIET_KEYS.map((diet) => (
            <label
              key={diet}
              className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2 text-xs"
            >
              <span>{labels.diet[diet]}</span>
              <CountInput
                value={selection.wishes[diet]}
                max={Math.max(0, partySize)}
                onChange={(value) => setWishes({ [diet]: value })}
                ariaLabel={labels.diet[diet]}
              />
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <MenuChoiceButton
          selected={selection.menuId == null}
          title={labels.none}
          onSelect={() =>
            onSelectionChange(
              selectionWithMenu(menus, null, partySize, selection.wishes),
            )
          }
        />
        {menus.map((menu) => {
          const fits = eventMenuFitsPartySize(menu, partySize);
          const range = eventMenuPartyRangeLabel(menu);
          const meta = !fits
            ? partySize > 0 && partySize < menu.minPartySize
              ? labels.tooFew(menu.minPartySize)
              : menu.maxPartySize != null
                ? labels.tooMany(menu.maxPartySize)
                : range
                  ? labels.partyRange(range)
                  : undefined
            : [
                range ? labels.partyRange(range) : null,
                menu.kidsPricePerPerson != null
                  ? labels.kidsPrice(formatMenuPrice(menu.kidsPricePerPerson))
                  : null,
              ]
                .filter(Boolean)
                .join(" · ") || undefined;
          return (
            <MenuChoiceButton
              key={menu.id}
              selected={selection.menuId === menu.id}
              title={menu.name}
              description={menu.description || undefined}
              meta={meta}
              disabled={!fits}
              priceLabel={labels.perPerson(formatMenuPrice(menu.pricePerPerson))}
              onSelect={() =>
                onSelectionChange(
                  selectionWithMenu(menus, menu.id, partySize, selection.wishes),
                )
              }
            />
          );
        })}
      </div>

      {selectedMenu && selectedMenu.courses.length > 0 ? (
        <div className="space-y-3">
          <p className="text-xs font-medium sm:text-sm">{labels.coursesTitle}</p>
          {selectedMenu.courses.map((course) => {
            const issue = issues.find((item) => item.courseId === course.id);
            if (course.selectionMode === "fixed") {
              if (course.options.length === 0) return null;
              return (
                <div key={course.id} className="space-y-1.5">
                  <p className="text-xs font-medium">
                    {course.name}{" "}
                    <span className="font-normal text-muted-foreground">
                      · {labels.included}
                    </span>
                  </p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {course.options.map((option) => (
                      <li key={option.id}>
                        {option.name}
                        {option.description ? ` — ${option.description}` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              );
            }
            if (course.options.length === 0) return null;
            const assigned = courseAssignedCount(course, selection);
            return (
              <div key={course.id} className="space-y-1.5">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">{course.name}</p>
                  {course.required || issue ? (
                    <p
                      className={cn(
                        "text-[11px] tabular-nums",
                        issue ? "text-destructive" : "text-muted-foreground",
                      )}
                    >
                      {labels.assigned(assigned, partySize)}
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  {course.options.map((option) => {
                    const count = selection.courseCounts[course.id]?.[option.id] ?? 0;
                    const dietNote = option.diets
                      .map((diet) => labels.diet[diet])
                      .join(" · ");
                    return (
                      <div
                        key={option.id}
                        className="flex items-start gap-2 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-medium">{option.name}</span>
                          {option.description ? (
                            <span className="mt-0.5 block text-xs text-muted-foreground">
                              {option.description}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-[11px] text-muted-foreground">
                            {[
                              dietNote || null,
                              option.extraPricePerPerson > 0
                                ? labels.extraPrice(
                                    formatMenuPrice(option.extraPricePerPerson),
                                  )
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </span>
                        </span>
                        <CountInput
                          value={count}
                          max={Math.max(0, partySize)}
                          onChange={(value) =>
                            setCourseCount(course.id, option.id, value)
                          }
                          ariaLabel={option.name}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : null}

      {selectedMenu && selectedMenu.addons.length > 0 ? (
        <div className="space-y-1.5">
          <p className="text-xs font-medium sm:text-sm">{labels.addonsTitle}</p>
          {selectedMenu.addons.map((addon) => {
            const max =
              addon.billing === "flat"
                ? 1
                : addon.excludeKids
                  ? Math.max(0, partySize - selection.wishes.kids)
                  : Math.max(0, partySize);
            const count = selection.addonCounts[addon.id] ?? 0;
            return (
              <div
                key={addon.id}
                className="flex items-start gap-2 rounded-xl border border-border/50 bg-background/60 px-2.5 py-2"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{addon.name}</span>
                  {addon.description ? (
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {addon.description}
                    </span>
                  ) : null}
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {[
                      formatMenuPrice(addon.price),
                      addon.billing === "flat"
                        ? labels.addonFlat
                        : labels.addonPerPerson,
                      addon.excludeKids ? labels.addonExcludeKids : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                </span>
                <CountInput
                  value={count}
                  max={max}
                  onChange={(value) => setAddonCount(addon.id, value)}
                  ariaLabel={addon.name}
                />
              </div>
            );
          })}
        </div>
      ) : null}

      {wishWarnings.length > 0 ? (
        <p className="text-xs text-muted-foreground">
          {labels.wishWarning(
            wishWarnings.map((diet) => labels.diet[diet]).join(", "),
          )}
        </p>
      ) : null}

      {selectedMenu && estimate > 0 ? (
        <p className="sr-only">{formatMenuPrice(estimate)}</p>
      ) : null}
    </div>
  );
}
