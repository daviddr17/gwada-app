/** Entspricht `public.employee_role` in Postgres. */
export type EmployeeRole =
  | "owner"
  | "manager"
  | "host"
  | "server"
  | "kitchen"
  | "other";

export const EMPLOYEE_ROLE_OPTIONS: readonly { value: EmployeeRole; label: string }[] =
  [
    { value: "owner", label: "Inhaber" },
    { value: "manager", label: "Manager" },
    { value: "host", label: "Gastgeber" },
    { value: "server", label: "Service" },
    { value: "kitchen", label: "Küche" },
    { value: "other", label: "Sonstiges" },
  ] as const;

export function isRestaurantOwnerRole(role: string | null | undefined): boolean {
  return role === "owner";
}

/** Mitarbeiterzeile ist der Restaurant-Inhaber (für Liste/Schichtplan). */
export function isStaffOwnerRow(row: {
  restaurant_position?: { slug: string } | null;
  linked_employee?: {
    role: string;
    restaurant_position?: { slug: string } | null;
  } | null;
}): boolean {
  if (row.restaurant_position?.slug === "owner") return true;
  if (row.linked_employee?.restaurant_position?.slug === "owner") return true;
  return isRestaurantOwnerRole(row.linked_employee?.role);
}
