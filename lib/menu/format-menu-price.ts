import {
  DEFAULT_MENU_CURRENCY_CODE,
  normalizeMenuCurrencyCode,
  type MenuCurrencyCode,
} from "@/lib/constants/menu-currencies";

const formatterCache = new Map<string, Intl.NumberFormat>();

function menuPriceFormatter(currencyCode: MenuCurrencyCode): Intl.NumberFormat {
  const cached = formatterCache.get(currencyCode);
  if (cached) return cached;
  const fmt = new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: currencyCode,
  });
  formatterCache.set(currencyCode, fmt);
  return fmt;
}

export function formatMenuPrice(
  price: number,
  currencyCode: string | null | undefined = DEFAULT_MENU_CURRENCY_CODE,
): string {
  const code = normalizeMenuCurrencyCode(currencyCode);
  return menuPriceFormatter(code).format(Math.max(0, price));
}
