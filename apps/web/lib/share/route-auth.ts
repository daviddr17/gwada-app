import "server-only";

import type { ShareSourceType } from "@/lib/constants/share-channels";
import { authorizeGalleryRestaurant } from "@/lib/gallery/route-auth";
import { authorizeModuleCrud } from "@/lib/permissions/authorize-restaurant-module";
import type { ModuleCrudPrefix } from "@/lib/permissions/module-crud-permissions";

const SOURCE_MODULE: Record<ShareSourceType, ModuleCrudPrefix | "gallery"> = {
  review: "reviews",
  menu_item: "menu",
  gallery: "gallery",
  news: "news",
};

export async function authorizeShareRestaurant(
  restaurantId: string,
  sourceType: ShareSourceType,
) {
  const moduleKey = SOURCE_MODULE[sourceType];
  if (moduleKey === "gallery") {
    return authorizeGalleryRestaurant(restaurantId, {
      permission: "gallery.create",
    });
  }
  return authorizeModuleCrud(restaurantId, moduleKey, "create");
}
