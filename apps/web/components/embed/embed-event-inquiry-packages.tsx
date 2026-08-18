"use client";

import type { ReactNode } from "react";
import {
  type EventPackageKind,
  type PublicEventPackage,
} from "@/lib/events/event-package";
import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import { cn } from "@/lib/utils";

export type EventInquiryPackageSelection = {
  buffetId: string | null;
  drinksId: string | null;
  extraIds: string[];
};

export function selectedEventInquiryPackageIds(
  selection: EventInquiryPackageSelection,
): string[] {
  return [
    selection.buffetId,
    selection.drinksId,
    ...selection.extraIds,
  ].filter((id): id is string => Boolean(id));
}

function packagesOfKind(
  packages: PublicEventPackage[],
  kind: EventPackageKind,
): PublicEventPackage[] {
  return packages.filter((pkg) => pkg.kind === kind);
}

const packageChoiceClassName =
  "flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-3 text-left text-sm transition-colors";

function PackageChoiceButton({
  selected,
  title,
  description,
  priceLabel,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description?: string;
  priceLabel?: string;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        packageChoiceClassName,
        selected
          ? "border-accent bg-accent/20"
          : "border-border/50 bg-transparent hover:border-border hover:bg-muted/40",
      )}
    >
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-muted-foreground">
            {description}
          </span>
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

function PackageKindSection({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium sm:text-sm">{label}</p>
      {children}
    </div>
  );
}

export function EmbedEventInquiryPackages({
  packages,
  selection,
  onSelectionChange,
  labels,
}: {
  packages: PublicEventPackage[];
  selection: EventInquiryPackageSelection;
  onSelectionChange: (next: EventInquiryPackageSelection) => void;
  labels: {
    title: string;
    hint: string;
    buffet: string;
    drinks: string;
    extra: string;
    noneBuffet: string;
    noneDrinks: string;
    perPerson: (price: string) => string;
    estimate: string;
    estimateHint: string;
    noneSelected: string;
  };
}) {
  if (packages.length === 0) return null;

  const buffets = packagesOfKind(packages, "buffet");
  const drinks = packagesOfKind(packages, "drinks");
  const extras = packagesOfKind(packages, "extra");
  const selectedIds = selectedEventInquiryPackageIds(selection);
  const selectedPackages = packages.filter((pkg) => selectedIds.includes(pkg.id));

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

      {buffets.length > 0 ? (
        <PackageKindSection label={labels.buffet}>
          <PackageChoiceButton
            selected={selection.buffetId == null}
            title={labels.noneBuffet}
            onSelect={() =>
              onSelectionChange({ ...selection, buffetId: null })
            }
          />
          {buffets.map((pkg) => (
            <PackageChoiceButton
              key={pkg.id}
              selected={selection.buffetId === pkg.id}
              title={pkg.name}
              description={pkg.description || undefined}
              priceLabel={labels.perPerson(formatMenuPrice(pkg.pricePerPerson))}
              onSelect={() =>
                onSelectionChange({ ...selection, buffetId: pkg.id })
              }
            />
          ))}
        </PackageKindSection>
      ) : null}

      {drinks.length > 0 ? (
        <PackageKindSection label={labels.drinks}>
          <PackageChoiceButton
            selected={selection.drinksId == null}
            title={labels.noneDrinks}
            onSelect={() =>
              onSelectionChange({ ...selection, drinksId: null })
            }
          />
          {drinks.map((pkg) => (
            <PackageChoiceButton
              key={pkg.id}
              selected={selection.drinksId === pkg.id}
              title={pkg.name}
              description={pkg.description || undefined}
              priceLabel={labels.perPerson(formatMenuPrice(pkg.pricePerPerson))}
              onSelect={() =>
                onSelectionChange({ ...selection, drinksId: pkg.id })
              }
            />
          ))}
        </PackageKindSection>
      ) : null}

      {extras.length > 0 ? (
        <PackageKindSection label={labels.extra}>
          {extras.map((pkg) => {
            const checked = selection.extraIds.includes(pkg.id);
            return (
              <PackageChoiceButton
                key={pkg.id}
                selected={checked}
                title={pkg.name}
                description={pkg.description || undefined}
                priceLabel={labels.perPerson(formatMenuPrice(pkg.pricePerPerson))}
                onSelect={() =>
                  onSelectionChange({
                    ...selection,
                    extraIds: checked
                      ? selection.extraIds.filter((id) => id !== pkg.id)
                      : [...selection.extraIds, pkg.id],
                  })
                }
              />
            );
          })}
        </PackageKindSection>
      ) : null}

      <div className="rounded-xl bg-background/70 px-3 py-2.5">
        {selectedPackages.length > 0 ? (
          <>
            <p className="text-sm font-medium" data-embed-mt>
              {labels.estimate}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground" data-embed-mt>
              {labels.estimateHint}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground" data-embed-mt>
            {labels.noneSelected}
          </p>
        )}
      </div>
    </div>
  );
}
