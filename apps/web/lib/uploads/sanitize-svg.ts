/**
 * Entfernt aktive Inhalte aus SVG-Logos, ohne Pfade/Farben anzufassen.
 * `null` = kein nutzbares SVG mehr.
 */
export function sanitizeSvgMarkup(input: string): string | null {
  const trimmed = input.replace(/^\uFEFF/, "").trim();
  if (trimmed.length === 0 || trimmed.length > 2_000_000) return null;
  if (!/<svg[\s>]/i.test(trimmed)) return null;

  let svg = trimmed
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<!DOCTYPE[\s\S]*?>/gi, "");

  const blocked =
    "script|foreignObject|iframe|object|embed|audio|video|link|meta|base|handler";
  const paired = new RegExp(
    `<\\s*(${blocked})\\b[\\s\\S]*?<\\s*/\\s*\\1\\s*>`,
    "gi",
  );
  const unpaired = new RegExp(`<\\s*(${blocked})\\b[^>]*\\/?>`, "gi");
  svg = svg.replace(paired, "").replace(unpaired, "");

  svg = svg
    .replace(/\s+on[a-z]+\s*=\s*(['"])[\s\S]*?\1/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*[^\s>]+/gi, "");

  svg = svg.replace(
    /(href|xlink:href|src)\s*=\s*(['"])\s*javascript:[\s\S]*?\2/gi,
    "",
  );
  svg = svg.replace(
    /(href|xlink:href|src)\s*=\s*(['"])\s*data:(?!image\/(?:png|jpeg|jpg|gif|webp);)[\s\S]*?\2/gi,
    "",
  );
  svg = svg.replace(
    /(href|xlink:href)\s*=\s*(['"])\s*(?:https?:|\/\/)[\s\S]*?\2/gi,
    "",
  );

  svg = svg.replace(
    /style\s*=\s*(['"])([\s\S]*?)\1/gi,
    (full, _q, body: string) =>
      /javascript:|expression\s*\(|@import|behavior\s*:|-moz-binding/i.test(body)
        ? ""
        : full,
  );
  svg = svg.replace(
    /<style\b[^>]*>([\s\S]*?)<\/style>/gi,
    (full, body: string) =>
      /javascript:|expression\s*\(|@import|behavior\s*:|-moz-binding/i.test(body)
        ? ""
        : full,
  );

  if (!/<svg[\s>]/i.test(svg)) return null;
  if (/<\s*script\b|javascript:|<\s*foreignObject\b/i.test(svg)) return null;
  return svg;
}

export function sanitizeSvgBytes(bytes: Uint8Array): Uint8Array | null {
  let text: string;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return null;
  }
  const clean = sanitizeSvgMarkup(text);
  if (!clean) return null;
  return new TextEncoder().encode(clean);
}
