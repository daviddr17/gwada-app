export type GuestCartModifier = {
  type: "ohne" | "option" | "text";
  label: string;
  ingredientId?: string;
  optionChoiceId?: string;
  priceDeltaCents?: number;
};

export type GuestCartLine = {
  key: string;
  menuItemId: string;
  name: string;
  unitPriceCents: number;
  quantity: number;
  notes?: string;
  ohneIngredientIds: string[];
  modifiers: GuestCartModifier[];
};

export function cartLineTotalCents(line: GuestCartLine): number {
  return line.unitPriceCents * line.quantity;
}

export function cartSubtotalCents(lines: GuestCartLine[]): number {
  return lines.reduce((sum, l) => sum + cartLineTotalCents(l), 0);
}

export function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}
