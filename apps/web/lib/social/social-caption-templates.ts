import type { SocialBrandKit, SocialTone } from "@/lib/social/social-brand-kit";

function toneFlavor(tone: SocialTone): string {
  switch (tone) {
    case "casual":
      return "Komm vorbei";
    case "fine":
      return "Wir freuen uns auf Ihren Besuch";
    case "modern":
      return "Reservierung empfohlen";
    case "warm":
    default:
      return "Wir freuen uns auf euch";
  }
}

function voiceHint(kit: SocialBrandKit): string {
  const v = kit.voiceNotes.trim();
  if (!v) return "";
  // Kurzer Hinweis fließt nicht wörtlich ein — steuert nur leichte Varianten.
  const lower = v.toLowerCase();
  if (lower.includes("siezen") || lower.includes("höflich")) return "formal";
  if (lower.includes("duzen") || lower.includes("locker")) return "du";
  return "";
}

function appendCtaAndTags(body: string, kit: SocialBrandKit): string {
  let text = body.trim();
  const banned = kit.doNot
    .toLowerCase()
    .split(/[,;\n]+/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 3);

  for (const b of banned) {
    // grobe Filter: Zeilen mit verbotenen Phrasen entfernen
    text = text
      .split("\n")
      .filter((line) => !line.toLowerCase().includes(b))
      .join("\n")
      .trim();
  }

  const parts = [text];
  const cta = kit.cta.trim();
  if (cta && !text.toLowerCase().includes(cta.toLowerCase())) {
    parts.push(cta);
  }
  if (kit.hashtags.length) {
    parts.push(kit.hashtags.slice(0, 5).join(" "));
  }
  return parts.filter(Boolean).join("\n\n");
}

function pickGold(kit: SocialBrandKit): string | null {
  const gold = kit.goldCaptions.map((c) => c.trim()).filter(Boolean);
  if (!gold.length) return null;
  return gold[Math.floor(Math.random() * gold.length)] ?? gold[0] ?? null;
}

export function captionForHoliday(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  holidayName: string;
}): string {
  const { kit, restaurantName, holidayName } = params;
  const formal = voiceHint(kit) === "formal" || kit.tone === "fine";
  const body = formal
    ? `${holidayName} bei ${restaurantName}.\nEin besonderer Anlass — wir decken für Sie den Tisch.`
    : kit.tone === "casual"
      ? `${holidayName} steht vor der Tür.\nBei ${restaurantName} seid ihr genau richtig.`
      : kit.tone === "modern"
        ? `${holidayName}.\n${restaurantName} — klar, ruhig, gut.`
        : `${holidayName} bei ${restaurantName}.\n${toneFlavor(kit.tone)} — für einen schönen Abend.`;
  return appendCtaAndTags(body, kit);
}

export function captionForDish(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  dishName: string;
  dishDescription?: string;
}): string {
  const { kit, restaurantName, dishName } = params;
  const gold = pickGold(kit);
  if (gold && gold.toLowerCase().includes(dishName.toLowerCase())) {
    return appendCtaAndTags(gold, kit);
  }
  const desc = params.dishDescription?.trim();
  const descLine =
    desc && desc.length > 12 && desc.length < 140 ? `\n${desc}` : "";
  const formal = voiceHint(kit) === "formal" || kit.tone === "fine";
  const body = formal
    ? `${dishName} — frisch zubereitet bei ${restaurantName}.${descLine}`
    : kit.tone === "casual"
      ? `Heute auf dem Teller: ${dishName}.${descLine}\nLust darauf?`
      : kit.tone === "modern"
        ? `${dishName}.\n${restaurantName}${descLine}`
        : `${dishName} bei ${restaurantName}.${descLine}\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}

export function captionForEvent(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  eventTitle: string;
  whenLabel: string;
}): string {
  const { kit, restaurantName, eventTitle, whenLabel } = params;
  const formal = voiceHint(kit) === "formal" || kit.tone === "fine";
  const body = formal
    ? `${eventTitle}\n${whenLabel} bei ${restaurantName}.\nWir freuen uns auf Ihren Besuch.`
    : `${eventTitle}\n${whenLabel} — ${restaurantName}.\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}

export function captionForBrand(params: {
  kit: SocialBrandKit;
  restaurantName: string;
}): string {
  const { kit, restaurantName } = params;
  const gold = pickGold(kit);
  if (gold) return appendCtaAndTags(gold, kit);
  const body =
    kit.tone === "fine"
      ? `${restaurantName}.\nGute Küche, ruhige Atmosphäre, ein Abend zum Ankommen.`
      : kit.tone === "casual"
        ? `${restaurantName} — euer Platz für gutes Essen und gute Laune.`
        : kit.tone === "modern"
          ? `${restaurantName}.\nWeniger Lärm. Mehr Geschmack.`
          : `${restaurantName}.\n${toneFlavor(kit.tone)} — heute und die ganze Woche.`;
  return appendCtaAndTags(body, kit);
}

export function captionForAmbient(params: {
  kit: SocialBrandKit;
  restaurantName: string;
}): string {
  const { kit, restaurantName } = params;
  const body =
    kit.tone === "modern"
      ? `${restaurantName}.\nRaum. Licht. Geschmack.`
      : kit.tone === "fine"
        ? `Einblicke bei ${restaurantName}.\nAtmosphäre, die bleibt.`
        : `Einblicke bei ${restaurantName}.\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}
