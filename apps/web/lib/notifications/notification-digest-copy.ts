export type DigestSection = {
  heading: string;
  lines: string[];
};

export function formatEuroFromCents(cents: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatEuroAmount(euros: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(euros);
}

export function compareLine(
  label: string,
  currentLabel: string,
  current: number,
  previous: number,
  previousLabel: string,
): string {
  if (previous === 0 && current === 0) return `${label}: ${currentLabel}`;
  if (previous === 0) return `${label}: ${currentLabel} (zuvor 0)`;
  const pct = Math.round(((current - previous) / previous) * 100);
  const sign = pct > 0 ? "+" : "";
  return `${label}: ${currentLabel} (zuvor ${previousLabel}, ${sign}${pct} %)`;
}

export function formatDigestDetails(params: {
  periodLabel: string;
  note: string | null;
  sections: DigestSection[];
}): string {
  const blocks = [`Zeitraum: ${params.periodLabel}`];
  if (params.note) blocks.push(params.note);
  for (const section of params.sections) {
    const lines = section.lines.filter((line) => line.trim());
    if (lines.length === 0) continue;
    blocks.push([section.heading, ...lines.map((line) => `• ${line}`)].join("\n"));
  }
  return blocks.join("\n\n");
}

export function formatDigestBellSubtitle(params: {
  periodLabel: string;
  sections: DigestSection[];
}): string {
  const first = params.sections.find((section) => section.lines.length > 0);
  const preview = first ? `${first.heading}: ${first.lines[0]}` : "Keine Zahlen";
  return `${params.periodLabel} · ${preview}`;
}
