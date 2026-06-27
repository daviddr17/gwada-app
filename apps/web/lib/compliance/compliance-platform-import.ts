import { resolveCountryIso2FromLabel } from "@/lib/constants/countries";
import { newComplianceItemId } from "@/lib/compliance/compliance-utils";
import type {
  ComplianceCategory,
  ComplianceChecklistItem,
} from "@/lib/types/compliance";
import type { PlatformComplianceChecklistTemplate } from "@/lib/types/platform-compliance-templates";

export function clonePlatformChecklistItems(
  items: ComplianceChecklistItem[],
): ComplianceChecklistItem[] {
  return items.map((item) => ({
    ...item,
    id: newComplianceItemId(),
    options: item.options ? [...item.options] : undefined,
  }));
}

/** Temperatur-Vorlagen: Geräte des Restaurants verknüpfen, falls vorhanden. */
export function mapPlatformItemsForRestaurantImport(
  template: Pick<PlatformComplianceChecklistTemplate, "category" | "items">,
  deviceIds: string[],
): ComplianceChecklistItem[] {
  const cloned = clonePlatformChecklistItems(template.items);

  if (template.category !== "temperature" || deviceIds.length === 0) {
    return cloned;
  }

  const fridgeDevices = deviceIds.slice(0, Math.max(1, deviceIds.length));
  return fridgeDevices.map((deviceId, index) => {
    const source = cloned[index] ?? cloned[0];
    if (!source) {
      return {
        id: newComplianceItemId(),
        label: `Gerät ${index + 1}`,
        fieldType: "temperature" as const,
        deviceId,
        maxValue: index === 0 && deviceIds.length > 1 ? -18 : 7,
        required: true,
      };
    }
    return {
      ...source,
      id: newComplianceItemId(),
      label: source.label || `Gerät ${index + 1}`,
      deviceId,
      maxValue:
        source.maxValue ??
        (index === 0 && deviceIds.length > 1 ? -18 : 7),
    };
  });
}

export function resolveRestaurantCountryCode(countryLabel: string | null | undefined): string {
  return resolveCountryIso2FromLabel(
    typeof countryLabel === "string" && countryLabel.trim()
      ? countryLabel
      : "DE",
  );
}

export function groupPlatformTemplatesByCategory(
  templates: PlatformComplianceChecklistTemplate[],
): Array<[ComplianceCategory, PlatformComplianceChecklistTemplate[]]> {
  const map = new Map<ComplianceCategory, PlatformComplianceChecklistTemplate[]>();
  for (const template of templates) {
    const list = map.get(template.category) ?? [];
    list.push(template);
    map.set(template.category, list);
  }
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
}
