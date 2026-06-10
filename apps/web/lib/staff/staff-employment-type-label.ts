import type {
  RestaurantStaffContractRow,
  StaffEmploymentTypeDefinition,
} from "@/lib/types/staff";

export function staffEmploymentTypeLabel(
  contract: Pick<
    RestaurantStaffContractRow,
    "employment_type_id" | "employment_type_name"
  >,
  types: readonly StaffEmploymentTypeDefinition[],
): string | null {
  if (contract.employment_type_name?.trim()) {
    return contract.employment_type_name.trim();
  }
  if (!contract.employment_type_id) return null;
  return (
    types.find((t) => t.id === contract.employment_type_id)?.name?.trim() ??
    null
  );
}

export function employmentTypeLabelById(
  id: string | null,
  types: readonly StaffEmploymentTypeDefinition[],
): string | null {
  if (!id) return null;
  return types.find((t) => t.id === id)?.name?.trim() ?? null;
}
