export const GWADA_DISPLAY_RECIPES_REFRESH_EVENT = "gwada:display-recipes-refresh";

export function dispatchDisplayRecipesRefresh(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(GWADA_DISPLAY_RECIPES_REFRESH_EVENT));
}
