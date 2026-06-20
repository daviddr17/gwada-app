import "server-only";

import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import type { ModuleCrudOperation } from "@/lib/permissions/module-crud-permissions";

export async function authorizeDocumentsRestaurant(
  restaurantId: string,
  operation: ModuleCrudOperation = "read",
) {
  return authorizeModuleCrud(restaurantId, "documents", operation);
}
