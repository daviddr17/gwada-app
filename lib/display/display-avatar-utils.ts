export function displayPersonInitials(given: string, family: string): string {
  const a = given.trim().slice(0, 1).toLocaleUpperCase("de-DE");
  const b = family.trim().slice(0, 1).toLocaleUpperCase("de-DE");
  if (a && b) return a + b;
  return a || b || "?";
}

export function displayRestaurantInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (
      parts[0]!.slice(0, 1).toLocaleUpperCase("de-DE") +
      parts[1]!.slice(0, 1).toLocaleUpperCase("de-DE")
    );
  }
  const single = name.trim().slice(0, 2).toLocaleUpperCase("de-DE");
  return single || "?";
}
