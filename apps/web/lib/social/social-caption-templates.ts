import type { SocialBrandKit, SocialTone } from "@/lib/social/social-brand-kit";

/**
 * Content-Wahrheit (ohne Bild-KI):
 * - Food-/Gericht-Claims NUR bei Slot `menu_dish` mit echtem Speisekarten-Namen.
 * - Galerie/Ambiente: nur Atmosphäre oder vorhandene Bild-Caption — nichts erfinden
 *   („Grill“, „Teller“, „Schnitzel“ …), nur weil ein Foto da ist.
 * - Feiertag/Event: Text bezieht sich auf den Anlass, nicht auf spekulierten Bildinhalt.
 */

export type SocialVoicePolicy = {
  formal: boolean;
  du: boolean;
  noEmoji: boolean;
  noAnglicisms: boolean;
  short: boolean;
};

export function voicePolicy(kit: SocialBrandKit): SocialVoicePolicy {
  const lower = kit.voiceNotes.toLowerCase();
  const formalHint =
    lower.includes("siezen") ||
    lower.includes("höflich") ||
    lower.includes("formell");
  const duHint =
    lower.includes("duzen") ||
    lower.includes("locker") ||
    lower.includes("familiär") ||
    lower.includes("familiar");
  return {
    formal: formalHint || (!duHint && kit.tone === "fine"),
    du: duHint || (!formalHint && kit.tone === "casual"),
    noEmoji:
      lower.includes("kein emoji") ||
      lower.includes("keine emoji") ||
      lower.includes("ohne emoji") ||
      lower.includes("keine emojis"),
    noAnglicisms:
      lower.includes("anglizism") ||
      lower.includes("kein english") ||
      lower.includes("kein englisch") ||
      lower.includes("nur deutsch") ||
      lower.includes("kein angli"),
    short:
      lower.includes("kurz") ||
      lower.includes("knapp") ||
      lower.includes("wenig text"),
  };
}

/** Stabiler Index aus Seed — gleiche Inputs → gleiche Caption-Variante. */
export function hashPick(seed: string, n: number): number {
  if (n <= 0) return 0;
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % n;
}

function pickVariant(seed: string, variants: string[]): string {
  if (!variants.length) return "";
  return variants[hashPick(seed, variants.length)] ?? variants[0] ?? "";
}

function inviteLine(kit: SocialBrandKit, voice: SocialVoicePolicy): string {
  if (voice.formal || kit.tone === "fine") {
    return pickVariant(`${kit.restaurantId}:invite:f`, [
      "Wir freuen uns auf Ihren Besuch.",
      "Ein Tisch wartet auf Sie.",
      "Wir begrüßen Sie gerne.",
    ]);
  }
  if (kit.tone === "casual" || voice.du) {
    return pickVariant(`${kit.restaurantId}:invite:d`, [
      "Komm vorbei.",
      "Wir freuen uns auf euch.",
      "Seht euch bei uns um.",
    ]);
  }
  if (kit.tone === "modern") {
    return pickVariant(`${kit.restaurantId}:invite:m`, [
      "Reservierung empfohlen.",
      "Wir sehen uns.",
      "Tisch sichern.",
    ]);
  }
  return pickVariant(`${kit.restaurantId}:invite:w`, [
    "Wir freuen uns auf euch.",
    "Bis bald bei uns.",
    "Ein guter Abend beginnt hier.",
  ]);
}

function scrubAnglicisms(text: string, voice: SocialVoicePolicy): string {
  if (!voice.noAnglicisms) return text;
  return text
    .replace(/\bVibes?\b/gi, "Stimmung")
    .replace(/\bMood\b/gi, "Atmosphäre")
    .replace(/\bFood\b/gi, "Küche")
    .replace(/\bDinner\b/gi, "Abendessen")
    .replace(/\bLunch\b/gi, "Mittagessen")
    .replace(/\bSpecial\b/gi, "Besonderheit")
    .replace(/\bCheck\s*it\s*out\b/gi, "Schaut vorbei")
    .replace(/\bBook\s*now\b/gi, "Jetzt reservieren");
}

function scrubEmoji(text: string, voice: SocialVoicePolicy): string {
  if (!voice.noEmoji) return text;
  return text
    .replace(/\p{Extended_Pictographic}/gu, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function finalizeBody(
  body: string,
  kit: SocialBrandKit,
  voice: SocialVoicePolicy,
): string {
  let text = body.trim();
  text = scrubAnglicisms(text, voice);
  text = scrubEmoji(text, voice);
  if (voice.short) {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .slice(0, 2);
    text = lines.join("\n");
  }
  return text;
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

function pickGold(kit: SocialBrandKit, seed: string): string | null {
  const gold = kit.goldCaptions.map((c) => c.trim()).filter(Boolean);
  if (!gold.length) return null;
  return gold[hashPick(seed, gold.length)] ?? gold[0] ?? null;
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

/**
 * Kurze Overlay-Zeile fürs Bild — ohne CTA, ohne Hashtag-Block.
 * Vorschau und Sharp-Render nutzen dieselbe Logik.
 */
export function overlayLineFromCaption(
  caption: string,
  kit?: Pick<SocialBrandKit, "cta"> | null,
): string {
  const cta = kit?.cta?.trim().toLowerCase() ?? "";
  const lines = caption
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    if (/^#[\p{L}\p{N}_]+(\s+#[\p{L}\p{N}_]+)*$/u.test(line)) continue;
    if (cta && line.toLowerCase() === cta) continue;
    const cleaned = line
      .replace(/(?:^|\s)#[\p{L}\p{N}_]+/gu, "")
      .replace(/\s+/g, " ")
      .trim();
    if (cleaned.length < 3) continue;
    return cleaned.length > 72 ? `${cleaned.slice(0, 69).trim()}…` : cleaned;
  }
  return (lines[0] ?? "").slice(0, 72);
}

function toneKey(tone: SocialTone): string {
  return tone;
}

export function captionForHoliday(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  holidayName: string;
}): string {
  const { kit, restaurantName, holidayName } = params;
  const voice = voicePolicy(kit);
  const seed = `${kit.restaurantId}:holiday:${holidayName}:${toneKey(kit.tone)}`;
  const invite = inviteLine(kit, voice);

  let body: string;
  if (voice.formal || kit.tone === "fine") {
    body = pickVariant(seed, [
      `${holidayName} bei ${restaurantName}.\nEin besonderer Anlass — wir freuen uns auf Sie.`,
      `${holidayName}.\nFeiern Sie mit uns bei ${restaurantName}.`,
      `${holidayName} — ${restaurantName}.\n${invite}`,
    ]);
  } else if (kit.tone === "casual") {
    body = pickVariant(seed, [
      `${holidayName} steht vor der Tür.\nBei ${restaurantName} seid ihr genau richtig.`,
      `${holidayName} bei ${restaurantName}.\n${invite}`,
      `${holidayName}.\nLasst uns gemeinsam feiern — ${restaurantName}.`,
    ]);
  } else if (kit.tone === "modern") {
    body = pickVariant(seed, [
      `${holidayName}.\n${restaurantName}.`,
      `${holidayName} · ${restaurantName}.\n${invite}`,
      `${holidayName}.\nRuhig. Klar. Bei uns.`,
    ]);
  } else {
    body = pickVariant(seed, [
      `${holidayName} bei ${restaurantName}.\n${invite}`,
      `${holidayName}.\nEin schöner Anlass bei ${restaurantName}.`,
      `${holidayName} — wir sind für euch da.`,
    ]);
  }

  return appendCtaAndTags(finalizeBody(body, kit, voice), kit);
}

export function captionForDish(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  dishName: string;
  dishDescription?: string;
}): string {
  const { kit, restaurantName, dishName } = params;
  const voice = voicePolicy(kit);
  const seed = `${kit.restaurantId}:dish:${dishName}:${toneKey(kit.tone)}`;
  const gold = pickGold(kit, seed);
  if (gold && gold.toLowerCase().includes(dishName.toLowerCase())) {
    return appendCtaAndTags(finalizeBody(gold, kit, voice), kit);
  }

  const desc = params.dishDescription?.trim();
  const descLine =
    desc && desc.length > 12 && desc.length < 140 ? `\n${desc}` : "";
  const invite = inviteLine(kit, voice);

  let body: string;
  if (voice.formal || kit.tone === "fine") {
    body = pickVariant(seed, [
      `${dishName}\nbei ${restaurantName}.${descLine}`,
      `${dishName}.\nMit Sorgfalt zubereitet — ${restaurantName}.${descLine}`,
      `${dishName} · ${restaurantName}.${descLine}\n${invite}`,
    ]);
  } else if (kit.tone === "casual") {
    body = pickVariant(seed, [
      `Heute auf dem Teller: ${dishName}.${descLine}`,
      `${dishName}.\nFrisch bei ${restaurantName}.${descLine}`,
      `Lust auf ${dishName}?${descLine}\n${invite}`,
    ]);
  } else if (kit.tone === "modern") {
    body = pickVariant(seed, [
      `${dishName}.\n${restaurantName}${descLine}`,
      `${dishName}${descLine}\n${restaurantName}.`,
      `${dishName}.${descLine}\n${invite}`,
    ]);
  } else {
    body = pickVariant(seed, [
      `${dishName} bei ${restaurantName}.${descLine}\n${invite}`,
      `${dishName}.${descLine}\nEin Klassiker bei ${restaurantName}.`,
      `Frisch zubereitet: ${dishName}.${descLine}`,
    ]);
  }

  return appendCtaAndTags(finalizeBody(body, kit, voice), kit);
}

export function captionForEvent(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  eventTitle: string;
  whenLabel: string;
}): string {
  const { kit, restaurantName, eventTitle, whenLabel } = params;
  const voice = voicePolicy(kit);
  const seed = `${kit.restaurantId}:event:${eventTitle}:${whenLabel}:${toneKey(kit.tone)}`;
  const invite = inviteLine(kit, voice);

  let body: string;
  if (voice.formal || kit.tone === "fine") {
    body = pickVariant(seed, [
      `${eventTitle}\n${whenLabel} bei ${restaurantName}.\nWir freuen uns auf Ihren Besuch.`,
      `${eventTitle}.\n${whenLabel} — ${restaurantName}.\n${invite}`,
      `Einladung: ${eventTitle}\n${whenLabel} bei ${restaurantName}.`,
    ]);
  } else if (kit.tone === "casual") {
    body = pickVariant(seed, [
      `${eventTitle}\n${whenLabel} — ${restaurantName}.\n${invite}`,
      `${eventTitle} steht an.\n${whenLabel} bei uns.`,
      `Seid dabei: ${eventTitle}\n${whenLabel}.`,
    ]);
  } else if (kit.tone === "modern") {
    body = pickVariant(seed, [
      `${eventTitle}.\n${whenLabel} · ${restaurantName}.`,
      `${eventTitle}\n${whenLabel}.`,
      `${eventTitle}.\n${whenLabel}\n${invite}`,
    ]);
  } else {
    body = pickVariant(seed, [
      `${eventTitle}\n${whenLabel} — ${restaurantName}.\n${invite}`,
      `${eventTitle}.\n${whenLabel} bei ${restaurantName}.`,
      `Ein schöner Abend: ${eventTitle}\n${whenLabel}.`,
    ]);
  }

  return appendCtaAndTags(finalizeBody(body, kit, voice), kit);
}

export function captionForBrand(params: {
  kit: SocialBrandKit;
  restaurantName: string;
}): string {
  const { kit, restaurantName } = params;
  const voice = voicePolicy(kit);
  const seed = `${kit.restaurantId}:brand:${toneKey(kit.tone)}`;
  const gold = pickGold(kit, seed);
  if (gold) return appendCtaAndTags(finalizeBody(gold, kit, voice), kit);
  const invite = inviteLine(kit, voice);

  let body: string;
  if (kit.tone === "fine") {
    body = pickVariant(seed, [
      `${restaurantName}.\nEin Ort zum Ankommen.`,
      `${restaurantName}.\nRuhig. Sorgfältig. Gastfreundlich.`,
      `${restaurantName}.\n${invite}`,
    ]);
  } else if (kit.tone === "casual") {
    body = pickVariant(seed, [
      `${restaurantName} — wir freuen uns auf euch.`,
      `${restaurantName}.\nGute Stimmung, ehrliche Küche.`,
      `${restaurantName}.\n${invite}`,
    ]);
  } else if (kit.tone === "modern") {
    body = pickVariant(seed, [
      `${restaurantName}.`,
      `${restaurantName}.\n${invite}`,
      `${restaurantName}.\nKlar. Einladend.`,
    ]);
  } else {
    body = pickVariant(seed, [
      `${restaurantName}.\n${invite}`,
      `${restaurantName}.\nEin Ort, an dem man gerne bleibt.`,
      `${restaurantName} — herzlich willkommen.`,
    ]);
  }

  return appendCtaAndTags(finalizeBody(body, kit, voice), kit);
}

export function captionForAmbient(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  /** Vorhandene Bildunterschrift aus Galerie — hat Vorrang. */
  imageCaption?: string | null;
}): string {
  const { kit, restaurantName } = params;
  const voice = voicePolicy(kit);
  const fromImage = usableGalleryCaption(params.imageCaption);
  if (fromImage) {
    return appendCtaAndTags(
      finalizeBody(`${fromImage}\n${restaurantName}`, kit, voice),
      kit,
    );
  }

  const seed = `${kit.restaurantId}:ambient:${toneKey(kit.tone)}`;
  const invite = inviteLine(kit, voice);

  let body: string;
  if (kit.tone === "modern") {
    body = pickVariant(seed, [
      `${restaurantName}.\nEin Moment bei uns.`,
      `${restaurantName}.\nLicht, Raum, Atmosphäre.`,
      `${restaurantName}.\n${invite}`,
    ]);
  } else if (kit.tone === "fine") {
    body = pickVariant(seed, [
      `Einblicke bei ${restaurantName}.`,
      `${restaurantName}.\nRuhige Atmosphäre.`,
      `Einblicke bei ${restaurantName}.\n${invite}`,
    ]);
  } else if (kit.tone === "casual") {
    body = pickVariant(seed, [
      `Stimmung bei ${restaurantName}.\n${invite}`,
      `${restaurantName} — so fühlt sich's an.`,
      `Ein Blick zu uns.\n${invite}`,
    ]);
  } else {
    body = pickVariant(seed, [
      `Einblicke bei ${restaurantName}.\n${invite}`,
      `${restaurantName}.\nAtmosphäre, die bleibt.`,
      `So sieht's bei uns aus.\n${invite}`,
    ]);
  }

  return appendCtaAndTags(finalizeBody(body, kit, voice), kit);
}

/** Overlay-Titel: nur wenn er zum Slot passt (Gericht/Event/Feiertag/Galerie-Caption). */
export function titleForAmbient(imageCaption?: string | null): string | null {
  return usableGalleryCaption(imageCaption);
}
