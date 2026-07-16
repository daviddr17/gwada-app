import { formatMenuPrice } from "@/lib/menu/format-menu-price";
import type { MenuOptionGroup } from "@/lib/types/menu";
import { cn } from "@/lib/utils";

function formatChoiceLabel(
  name: string,
  priceDelta: number,
  currencyCode?: string,
): string {
  if (!(priceDelta > 0)) return name;
  return `${name} (+${formatMenuPrice(priceDelta, currencyCode)})`;
}

/**
 * Öffentliche Speisekarte (Profil / Embed): Optionsgruppen ausgeschrieben.
 * Keine Auswahl — die braucht Online-/Tischbestellung oder POS.
 */
export function PublicMenuItemOptionsDisplay({
  groups,
  currencyCode,
  className,
}: {
  groups: readonly MenuOptionGroup[];
  currencyCode?: string;
  className?: string;
}) {
  if (!groups.length) return null;

  return (
    <div className={cn("mt-2 space-y-1", className)}>
      {groups.map((group) => {
        const choices = group.choices.filter((c) => c.active !== false);
        if (!choices.length) return null;
        return (
          <p
            key={group.id}
            className="text-[0.8125rem] leading-relaxed text-muted-foreground"
          >
            <span className="font-medium text-foreground/75">{group.name}: </span>
            {choices.map((choice, index) => (
              <span key={choice.id}>
                {index > 0 ? " · " : null}
                {formatChoiceLabel(choice.name, choice.priceDelta, currencyCode)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

/** Löst zugeordnete, anzeigbare Gruppen für ein Gericht auf. */
export function resolveMenuItemOptionGroups(
  optionGroupIds: readonly string[] | undefined,
  optionGroupsById: ReadonlyMap<string, MenuOptionGroup>,
): MenuOptionGroup[] {
  if (!optionGroupIds?.length) return [];
  const out: MenuOptionGroup[] = [];
  for (const id of optionGroupIds) {
    const group = optionGroupsById.get(id);
    if (!group) continue;
    const choices = group.choices.filter((c) => c.active !== false);
    if (!choices.length) continue;
    out.push(choices.length === group.choices.length ? group : { ...group, choices });
  }
  return out;
}
