import type { SocialBrandKit } from "./social-brand-kit";
import {
  clipAutopilotText,
  SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS,
} from "./social-autopilot-bounds";

export type SocialAutopilotCaptionJob = {
  index: number;
  slotKind: string;
  title: string | null;
  imageLabel: string | null;
  /** Öffentliche/signierte Bild-URL — optional für Vision (KI-Post). */
  imageUrl?: string | null;
  /** Fakten, die das Modell nutzen darf — keine Spekulation darüber hinaus. */
  facts: Record<string, string>;
  templateCaption: string;
};

function toneLabel(tone: SocialBrandKit["tone"]): string {
  switch (tone) {
    case "casual":
      return "locker, duzend wo passend";
    case "fine":
      return "fein, ruhig, eher Siezen";
    case "modern":
      return "modern, klar, knapp";
    default:
      return "warm und einladend";
  }
}

/** OpenAI-Vision (gpt-4o*) — Grok-Default ohne Vision im Modellnamen. */
export function autopilotCaptionSupportsVision(llm: {
  provider: "openai" | "grok" | string;
  model: string;
}): boolean {
  const m = llm.model.toLowerCase();
  if (llm.provider === "openai") {
    return (
      m.includes("gpt-4o") ||
      m.includes("gpt-4.1") ||
      m.includes("gpt-5") ||
      m.includes("vision")
    );
  }
  return m.includes("vision");
}

/**
 * Systemregeln: Bild vor Brief, Brand-Stimme, keine Marketing-Floskeln.
 * Exportiert für Unit-Tests.
 */
export function buildAutopilotCaptionSystemPrompt(
  restaurantName: string,
): string {
  return [
    `Du schreibst Social-Media-Beiträge (Instagram/Facebook/Google) für das Restaurant „${restaurantName}" in Deutschland.`,
    "Ton: echte deutsche Gastronomie — warm, konkret, einladend. Kein Agentur-Deutsch, kein Influencer-Sprech.",
    "Brand Kit (tone, voiceNotes, doNot, goldCaptions, cta, hashtags) ist verbindlich — Stimme und Verbote strikt einhalten. goldCaptions sind Stil-Vorbild, nicht zum Kopieren.",
    "BILD IST WAHRHEIT: Wenn ein Foto mitgeliefert ist oder facts.imageCaption / imageLabel den Bildinhalt beschreiben, muss die Caption sichtbar zum Bild passen (Ort, Licht, Ambiente, was man sieht).",
    "facts.userBrief ist nur ein Wunsch des Nutzers — kein Freibrief, Bildinhalt zu erfinden.",
    "Konflikt Brief ↔ Bild (z. B. Halloween-Brief + Sommerterrasse/Hafen ohne Kostüme): Schreibe über das, was im Bild wirklich zu sehen ist. Den Brief höchstens dezent als separaten Hinweis, ohne Requisiten/Stimmung zu behaupten, die das Foto nicht zeigt. Passt der Brief gar nicht: Brief weglassen und nur zum Bild schreiben.",
    "Keine leeren Marketing-Floskeln: vermeide Phrasen wie „viele Überraschungen“, „sorgen für Stimmung“, „Spooky und einladend“, „einzigartig“, „unvergesslich“, „magische Atmosphäre“, austauschbare Standard-CTAs ohne Inhalt.",
    "Nur Fakten aus dem JSON-Job und dem sichtbaren Bild. Keine erfundenen Gerichte, Preise, Aktionen, Kürbisse, Verkleidungen oder Events, die nicht belegt sind.",
    "Jeder Post klar am Slot (Gericht, Event, Galerie/Ambiente, Feiertag, Marke) — keine austauschbaren Standardtexte.",
    "Jeder Caption-Text: 2–4 kurze Zeilen, dann optional CTA aus dem Brand Kit, dann Hashtags (max. 5) wenn im Brand Kit vorgegeben.",
    'Antwort ausschließlich als JSON-Array: [{"index":0,"title":"…","caption":"…"}, …]',
    "Kein Markdown, keine Erklärung außerhalb des JSON.",
  ].join("\n");
}

export function buildAutopilotCaptionUserPrompt(params: {
  kit: SocialBrandKit;
  restaurantName: string;
  jobs: SocialAutopilotCaptionJob[];
  /** Wenn true: Modell sieht die Bilder zusätzlich — Prompt verweist darauf. */
  withVisionImages?: boolean;
}): string {
  const { kit, restaurantName, jobs, withVisionImages } = params;
  const gold = kit.goldCaptions
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 4)
    .map((c) => clipAutopilotText(c, 220));

  const brand = {
    restaurantName,
    tone: toneLabel(kit.tone),
    voiceNotes: clipAutopilotText(kit.voiceNotes || "—", 280),
    doNot: clipAutopilotText(kit.doNot || "—", 200),
    cta: clipAutopilotText(kit.cta || "", 80),
    hashtags: kit.hashtags.slice(0, 5),
    goldCaptions: gold,
  };

  const payload = {
    brand,
    rules: {
      imageFirst: true,
      userBriefSecondary: true,
      noEmptyFluff: true,
      visionAttached: Boolean(withVisionImages),
    },
    posts: jobs.map((j) => ({
      index: j.index,
      slotKind: j.slotKind,
      title: j.title,
      imageLabel: j.imageLabel,
      hasImage: Boolean(j.imageUrl?.trim()),
      facts: j.facts,
      styleHint: clipAutopilotText(j.templateCaption, 220),
    })),
  };

  let json = JSON.stringify(payload, null, 0);
  if (json.length > SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS) {
    const slim = {
      brand: {
        ...brand,
        goldCaptions: gold.slice(0, 1),
        voiceNotes: clipAutopilotText(kit.voiceNotes || "—", 120),
      },
      rules: payload.rules,
      posts: jobs.map((j) => ({
        index: j.index,
        slotKind: j.slotKind,
        title: j.title,
        imageLabel: j.imageLabel,
        hasImage: Boolean(j.imageUrl?.trim()),
        facts: j.facts,
      })),
    };
    json = JSON.stringify(slim, null, 0);
    if (json.length > SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS) {
      json = json.slice(0, SOCIAL_AUTOPILOT_MAX_PROMPT_CHARS);
    }
  }

  const visionHint = withVisionImages
    ? " Zusätzlich siehst du das/die Foto(s) — beschreibe nur, was darauf zu sehen ist.\n"
    : "\n";

  return `Schreibe für jeden Eintrag in posts einen Titel (kurz) und eine Caption. Behalte die index-Werte bei.${visionHint}${json}`;
}

/** Max. 1 Vision-Bild (KI-Post / Kostenkappe). */
export function pickAutopilotVisionImageUrls(
  jobs: SocialAutopilotCaptionJob[],
  max = 1,
): string[] {
  const out: string[] = [];
  for (const j of jobs) {
    const url = j.imageUrl?.trim();
    if (!url) continue;
    if (!/^https?:\/\//i.test(url)) continue;
    out.push(url);
    if (out.length >= max) break;
  }
  return out;
}
