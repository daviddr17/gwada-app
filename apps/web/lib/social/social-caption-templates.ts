import type { SocialBrandKit, SocialTone } from "@/lib/social/social-brand-kit";

/**
 * Content-Wahrheit (ohne Bild-KI):
 * - Food-/Gericht-Claims NUR bei Slot `menu_dish` mit echtem Speisekarten-Namen.
 * - Galerie/Ambiente: nur Atmosphäre oder vorhandene Bild-Caption — nichts erfinden
 *   („Grill“, „Teller“, „Schnitzel“ …), nur weil ein Foto da ist.
 * - Feiertag/Event: Text bezieht sich auf den Anlass, nicht auf spekulierten Bildinhalt.
 */

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

/** Sinnvolle Galerie-Caption (keine Platzhalter wie „Galerie“). */
export function usableGalleryCaption(label: string | null | undefined): string | null {
  const t = label?.trim() ?? "";
  if (t.length < 3) return null;
  const lower = t.toLowerCase();
  if (lower === "galerie" || lower === "gallery" || lower === "foto") return null;
  if (t.length > 160) return `${t.slice(0, 157).trim()}…`;
  return t;
}

export function captionForHoliday(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  holidayName: string;
}): string {
  const { kit, restaurantName, holidayName } = params;
  const formal = voiceHint(kit) === "formal" || kit.tone === "fine";
  // Nur Anlass + Ort — kein Bezug zu speziellem Gericht/Bildinhalt.
  const body = formal
    ? `${holidayName} bei ${restaurantName}.\nEin besonderer Anlass — wir freuen uns auf Sie.`
    : kit.tone === "casual"
      ? `${holidayName} steht vor der Tür.\nBei ${restaurantName} seid ihr genau richtig.`
      : kit.tone === "modern"
        ? `${holidayName}.\n${restaurantName}.`
        : `${holidayName} bei ${restaurantName}.\n${toneFlavor(kit.tone)}.`;
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
  // Gerichtname kommt aus der Speisekarte — Bild sollte dasselbe Gericht sein.
  const body = formal
    ? `${dishName}\nbei ${restaurantName}.${descLine}`
    : kit.tone === "casual"
      ? `Heute auf dem Teller: ${dishName}.${descLine}`
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
  // Keine erfundenen Food-Claims — nur Marke / Einladung.
  const body =
    kit.tone === "fine"
      ? `${restaurantName}.\nEin Ort zum Ankommen.`
      : kit.tone === "casual"
        ? `${restaurantName} — wir freuen uns auf euch.`
        : kit.tone === "modern"
          ? `${restaurantName}.`
          : `${restaurantName}.\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}

export function captionForAmbient(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  /** Vorhandene Bildunterschrift aus Galerie — hat Vorrang. */
  imageCaption?: string | null;
}): string {
  const { kit, restaurantName } = params;
  const fromImage = usableGalleryCaption(params.imageCaption);
  if (fromImage) {
    return appendCtaAndTags(
      `${fromImage}\n${restaurantName}`,
      kit,
    );
  }
  // Nur Atmosphäre / Einladung — nichts über Speisen behaupten.
  const body =
    kit.tone === "modern"
      ? `${restaurantName}.\nEin Moment bei uns.`
      : kit.tone === "fine"
        ? `Einblicke bei ${restaurantName}.`
        : kit.tone === "casual"
          ? `Stimmung bei ${restaurantName}.\n${toneFlavor(kit.tone)}.`
          : `Einblicke bei ${restaurantName}.\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}

/** Overlay-Titel: nur wenn er zum Slot passt (Gericht/Event/Feiertag/Galerie-Caption). */
export function titleForAmbient(imageCaption?: string | null): string | null {
  return usableGalleryCaption(imageCaption);
}
