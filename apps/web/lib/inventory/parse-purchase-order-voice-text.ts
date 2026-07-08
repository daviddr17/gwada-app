import {
  GERMAN_NUMBER_WORDS,
  isQuantityToken,
  parseGermanQuantityToken,
} from "@/lib/voice/german-number-words";

export type ParsedPurchaseOrderVoiceItem = {
  articleQuery: string;
  quantity: number;
};

export type ParsedPurchaseOrderVoice = {
  items: ParsedPurchaseOrderVoiceItem[];
};

export type ParsePurchaseOrderVoiceResult =
  | { ok: true; parsed: ParsedPurchaseOrderVoice }
  | { ok: false; error: string };

const UNIT_WORDS =
  /\b(kg|kilogramm|g|gramm|l|liter|ml|milliliter|stk|stück|stueck|stuecke|stücke|packung|packungen|x)\b/gi;

function normalizeText(input: string): string {
  return input
    .replace(/\s+/g, " ")
    .replace(/[,;]/g, " ")
    .trim();
}

function stripPrefixes(text: string): string {
  return text
    .replace(
      /^(?:bitte\s+)?(?:zur\s+)?bestell(?:ung|en)?(?:\s+(?:hinzu|hinzufügen|aufnehmen))?(?:\s+für)?\s*/i,
      "",
    )
    .replace(/^bestelle\s+/i, "")
    .replace(/^in\s+die\s+bestellung\s+/i, "")
    .trim();
}

function stripUnitWords(text: string): string {
  return text.replace(UNIT_WORDS, " ").replace(/\s+/g, " ").trim();
}

function splitSegments(text: string): string[] {
  return text
    .split(/\s+und\s+|,/i)
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseSingleSegment(segment: string): ParsedPurchaseOrderVoiceItem | null {
  let text = normalizeText(segment);
  if (!text) return null;

  const qtyFirst = text.match(
    new RegExp(
      `^(\\d+(?:[.,]\\d+)?|${Object.keys(GERMAN_NUMBER_WORDS).join("|")})\\s+(.+)$`,
      "i",
    ),
  );
  if (qtyFirst) {
    const quantity = parseGermanQuantityToken(qtyFirst[1]!);
    const articleQuery = stripUnitWords(qtyFirst[2]!);
    if (quantity != null && articleQuery) {
      return { articleQuery, quantity };
    }
  }

  const parts = text.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && isQuantityToken(parts[parts.length - 1]!)) {
    const quantity = parseGermanQuantityToken(parts[parts.length - 1]!);
    const articleQuery = stripUnitWords(parts.slice(0, -1).join(" "));
    if (quantity != null && articleQuery) {
      return { articleQuery, quantity };
    }
  }

  const articleOnly = stripUnitWords(text);
  if (articleOnly) {
    return { articleQuery: articleOnly, quantity: 1 };
  }

  return null;
}

export function parsePurchaseOrderVoiceText(
  input: string,
): ParsePurchaseOrderVoiceResult {
  const text = stripPrefixes(normalizeText(input));
  if (!text) {
    return {
      ok: false,
      error: "Kein Text erkannt. Bitte Zutat und Menge nennen.",
    };
  }

  const segments = splitSegments(text);
  const items: ParsedPurchaseOrderVoiceItem[] = [];

  for (const segment of segments) {
    const item = parseSingleSegment(segment);
    if (!item) {
      return {
        ok: false,
        error: `„${segment}" konnte nicht gelesen werden (z. B. „3 Tomaten“ oder „Mehl 2“).`,
      };
    }
    items.push(item);
  }

  if (items.length === 0) {
    return {
      ok: false,
      error: "Keine Zutat erkannt. Beispiel: „3 Tomaten“ oder „2 Zwiebeln und 1 Mehl“.",
    };
  }

  return { ok: true, parsed: { items } };
}

export function formatParsedPurchaseOrderVoicePreview(
  lines: Array<{
    ingredientName: string;
    quantity: number;
    unitLabel: string;
    previousQuantity: number | null;
  }>,
): string {
  return lines
    .map((line) => {
      const qtyLabel = line.unitLabel.trim()
        ? `${line.quantity} ${line.unitLabel}`
        : String(line.quantity);
      if (line.previousQuantity != null && line.previousQuantity > 0) {
        const prevLabel = line.unitLabel.trim()
          ? `${line.previousQuantity} ${line.unitLabel}`
          : String(line.previousQuantity);
        return `${line.ingredientName}: ${prevLabel} → ${qtyLabel}`;
      }
      return `${line.ingredientName}: ${qtyLabel}`;
    })
    .join(" · ");
}
