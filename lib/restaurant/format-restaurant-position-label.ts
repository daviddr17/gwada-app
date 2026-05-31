import { EMPLOYEE_ROLE_OPTIONS } from "@/lib/types/employee-role";

/** Anzeigename für Restaurant-Positionen (App-Rollen) — Klartext statt Slug. */
export function formatRestaurantPositionLabel(position: {
  name: string;
  slug: string;
}): string {
  const fromSystem = EMPLOYEE_ROLE_OPTIONS.find((o) => o.value === position.slug);
  if (fromSystem) return fromSystem.label;
  const name = position.name.trim();
  if (name) return name;
  return position.slug;
}
