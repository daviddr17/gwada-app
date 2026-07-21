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

function appendCtaAndTags(body: string, kit: SocialBrandKit): string {
  const parts = [body.trim()];
  const cta = kit.cta.trim();
  if (cta && !body.includes(cta)) parts.push(cta);
  if (kit.hashtags.length) {
    parts.push(kit.hashtags.slice(0, 5).join(" "));
  }
  return parts.filter(Boolean).join("\n\n");
}

export function captionForHoliday(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  holidayName: string;
}): string {
  const { kit, restaurantName, holidayName } = params;
  const body =
    kit.tone === "fine"
      ? `${holidayName} bei ${restaurantName}.\nEin besonderer Anlass verdient besondere Momente am Tisch.`
      : kit.tone === "casual"
        ? `${holidayName} steht vor der Tür — bei ${restaurantName} seid ihr richtig.`
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
  const desc = params.dishDescription?.trim();
  const descLine =
    desc && desc.length > 12 && desc.length < 160 ? `\n${desc}` : "";
  const body =
    kit.tone === "fine"
      ? `${dishName} — frisch zubereitet bei ${restaurantName}.${descLine}`
      : kit.tone === "casual"
        ? `Heute auf dem Teller: ${dishName}.${descLine}\nLust drauf?`
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
  const body = `${eventTitle}\n${whenLabel} bei ${restaurantName}.\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}

export function captionForBrand(params: {
  kit: SocialBrandKit;
  restaurantName: string;
}): string {
  const { kit, restaurantName } = params;
  const gold = kit.goldCaptions[0]?.trim();
  if (gold) return appendCtaAndTags(gold, kit);
  const body =
    kit.tone === "fine"
      ? `${restaurantName}.\nGute Küche, ruhige Atmosphäre, ein Abend zum Ankommen.`
      : kit.tone === "casual"
        ? `${restaurantName} — euer Platz für gutes Essen und gute Laune.`
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
      : `Einblicke bei ${restaurantName}.\n${toneFlavor(kit.tone)}.`;
  return appendCtaAndTags(body, kit);
}
