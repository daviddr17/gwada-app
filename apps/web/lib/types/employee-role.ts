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
