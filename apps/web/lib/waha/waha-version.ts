/** WAHA-Versionsvergleich (API + GitHub Releases). */

export type WahaServerVersionInfo = {
  version: string | null;
  engine: string | null;
  nodeVersion: string | null;
};

export type WahaLatestReleaseInfo = {
  version: string;
  publishedAt: string | null;
  htmlUrl: string | null;
  /** GitHub Release-Body (Markdown) — für lesbare Versionshinweise. */
  body: string | null;
};

export type WahaReleaseNotesSection = {
  title: string;
  items: string[];
};

/** Bekannte englische Release-Abschnitte → deutsche UI-Titel. */
const WAHA_RELEASE_SECTION_LABELS: Record<string, string> = {
  new: "Neu",
  features: "Neu",
  feature: "Neu",
  fixes: "Fehlerbehebungen",
  fix: "Fehlerbehebungen",
  "bug fixes": "Fehlerbehebungen",
  improvements: "Verbesserungen",
  improvement: "Verbesserungen",
  breaking: "Breaking Changes",
  "breaking changes": "Breaking Changes",
  security: "Sicherheit",
  docs: "Dokumentation",
  documentation: "Dokumentation",
  deprecated: "Veraltet",
  internal: "Intern",
  chatwoot: "ChatWoot",
  engines: "Engines",
  core: "Core",
};

function stripMarkdownInline(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

/** Eine Changelog-Zeile ohne Markdown-/Versions-Rauschen. */
export function cleanWahaReleaseNoteItem(raw: string): string {
  let s = raw.trim().replace(/^[-•*]\s+/, "").trim();
  s = s.replace(/^`?\d{4}\.\d{1,2}\.\d{1,2}`?\s*[-–—:]\s*/i, "");
  return stripMarkdownInline(s);
}

function isWahaReleaseSectionHeading(line: string): boolean {
  const t = line.trim();
  if (!t || /^[-•*]\s/.test(t)) return false;
  if (/^\*\*[^*]+\*\*\s*$/.test(t)) return true;
  // Emoji + **Title** oder kurzer Titel ohne Bullet
  if (/\*\*[^*]+\*\*/.test(t) && t.length < 80) return true;
  return false;
}

function localizeWahaReleaseSectionTitle(raw: string): string {
  const plain = stripMarkdownInline(raw)
    .replace(
      /^[\p{Extended_Pictographic}\p{Emoji_Presentation}\uFE0F\u200D\s]+/u,
      "",
    )
    .trim();
  if (!plain) return "Hinweise";
  const key = plain.toLowerCase();
  return WAHA_RELEASE_SECTION_LABELS[key] ?? plain;
}

/**
 * GitHub-Release-Body → Abschnitte mit lesbaren Stichpunkten
 * (kein Roh-JSON / kein rohes Markdown).
 */
export function parseWahaReleaseNotes(
  body: string | null | undefined,
): WahaReleaseNotesSection[] {
  if (!body?.trim()) return [];

  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const sections: WahaReleaseNotesSection[] = [];
  let current: WahaReleaseNotesSection | null = null;

  const pushCurrent = () => {
    if (current && current.items.length > 0) {
      sections.push(current);
    }
    current = null;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (/^<!--/.test(trimmed) || /^-->/.test(trimmed)) continue;
    if (/^full changelog/i.test(stripMarkdownInline(trimmed))) continue;

    if (isWahaReleaseSectionHeading(trimmed)) {
      pushCurrent();
      current = {
        title: localizeWahaReleaseSectionTitle(trimmed),
        items: [],
      };
      continue;
    }

    if (!/^[-•*]\s/.test(trimmed)) {
      // Freitext unter aktuellem Abschnitt oder als eigener Hinweis
      const cleaned = cleanWahaReleaseNoteItem(trimmed);
      if (!cleaned) continue;
      if (!current) {
        current = { title: "Hinweise", items: [] };
      }
      current.items.push(cleaned);
      continue;
    }

    const item = cleanWahaReleaseNoteItem(trimmed);
    if (!item) continue;
    if (!current) {
      current = { title: "Änderungen", items: [] };
    }
    current.items.push(item);
  }

  pushCurrent();
  return sections;
}

/** Extrahiert `2026.7.2` aus Tags wie `latest-2026.7.2`, `v2026.7.2`, `noweb-2026.7.2`. */
export function normalizeWahaVersion(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const s = raw.trim().replace(/^v/i, "");
  const m = s.match(/(\d{4}\.\d{1,2}\.\d{1,2})/);
  return m?.[1] ?? (s || null);
}

/** Vergleich `YYYY.M.B` — positiv wenn a > b. */
export function compareWahaVersions(a: string, b: string): number {
  const pa = a.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const pb = b.split(".").map((x) => Number.parseInt(x, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da !== db) return da - db;
  }
  return 0;
}

export function isWahaUpdateAvailable(
  currentRaw: string | null | undefined,
  latestRaw: string | null | undefined,
): boolean {
  const current = normalizeWahaVersion(currentRaw);
  const latest = normalizeWahaVersion(latestRaw);
  if (!current || !latest) return false;
  return compareWahaVersions(latest, current) > 0;
}

export function parseWahaVersionPayload(body: unknown): WahaServerVersionInfo {
  if (!body || typeof body !== "object") {
    return { version: null, engine: null, nodeVersion: null };
  }
  const o = body as Record<string, unknown>;
  const version =
    typeof o.version === "string"
      ? o.version
      : typeof o.Version === "string"
        ? o.Version
        : null;
  const engine =
    typeof o.engine === "string"
      ? o.engine
      : typeof o.Engine === "string"
        ? o.Engine
        : null;
  const nodeVersion =
    typeof o.node_version === "string"
      ? o.node_version
      : typeof o.nodeVersion === "string"
        ? o.nodeVersion
        : null;
  return { version, engine, nodeVersion };
}
