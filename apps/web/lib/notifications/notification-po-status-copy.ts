export type PoStatusNotifyModuleId =
  | "inventory_po_ordered"
  | "inventory_po_closed";

export type PoStatusLinePayload = {
  ingredientName: string;
  articleNumber: string | null;
  brandLabel: string | null;
  quantityLabel: string;
  unitLabel: string | null;
  deliveryStatus: string | null;
  deliveredQuantityLabel: string | null;
  deliveryNote: string | null;
};

const PUSH_LINE_CAP = 25;

function pickString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function formatPoQty(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number(value);
    if (Number.isFinite(n)) return String(n);
  }
  return null;
}

export function formatPoDeliveryDateDe(value: unknown): string | null {
  const raw = pickString(value);
  if (!raw) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return raw;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function parsePoStatusLines(value: unknown): PoStatusLinePayload[] {
  if (!Array.isArray(value)) return [];
  const lines: PoStatusLinePayload[] = [];
  for (const raw of value) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const name = pickString(row.ingredientName) ?? "Artikel";
    const qty = formatPoQty(row.quantity);
    lines.push({
      ingredientName: name,
      articleNumber: pickString(row.articleNumber),
      brandLabel: pickString(row.brandLabel),
      quantityLabel: qty ?? "—",
      unitLabel: pickString(row.unitLabel),
      deliveryStatus: pickString(row.deliveryStatus),
      deliveredQuantityLabel: formatPoQty(row.deliveredQuantity),
      deliveryNote: pickString(row.deliveryNote),
    });
  }
  return lines;
}

function qtyWithUnit(qty: string, unit: string | null): string {
  return unit ? `${qty} ${unit}` : qty;
}

function lineIdentity(line: PoStatusLinePayload): string {
  const bits = [line.ingredientName];
  const extra = [line.brandLabel, line.articleNumber ? `Art. ${line.articleNumber}` : null]
    .filter(Boolean)
    .join(", ");
  if (extra) bits.push(`(${extra})`);
  return bits.join(" ");
}

export function formatPoStatusLine(line: PoStatusLinePayload): string {
  return `• ${lineIdentity(line)} — ${qtyWithUnit(line.quantityLabel, line.unitLabel)}`;
}

export function formatPoStatusException(line: PoStatusLinePayload): string | null {
  const identity = lineIdentity(line);
  const ordered = qtyWithUnit(line.quantityLabel, line.unitLabel);
  const note = line.deliveryNote ? ` · ${line.deliveryNote}` : "";
  if (line.deliveryStatus === "not_delivered") {
    return `• ${identity} — fehlend (bestellt ${ordered})${note}`;
  }
  if (line.deliveryStatus === "partial") {
    const delivered = line.deliveredQuantityLabel
      ? qtyWithUnit(line.deliveredQuantityLabel, line.unitLabel)
      : "—";
    return `• ${identity} — abweichend (bestellt ${ordered}, geliefert ${delivered})${note}`;
  }
  return null;
}

function capLines(lines: string[]): string[] {
  if (lines.length <= PUSH_LINE_CAP) return lines;
  return [
    ...lines.slice(0, PUSH_LINE_CAP),
    `… und ${lines.length - PUSH_LINE_CAP} weitere`,
  ];
}

export function poStatusExceptionCounts(lines: PoStatusLinePayload[]): {
  missing: number;
  partial: number;
} {
  let missing = 0;
  let partial = 0;
  for (const line of lines) {
    if (line.deliveryStatus === "not_delivered") missing += 1;
    else if (line.deliveryStatus === "partial") partial += 1;
  }
  return { missing, partial };
}

export function formatPoStatusBellSubtitle(params: {
  module: PoStatusNotifyModuleId;
  supplierName: string;
  deliveryDate: unknown;
  lines: PoStatusLinePayload[];
}): string {
  const date = formatPoDeliveryDateDe(params.deliveryDate);
  const names = params.lines
    .slice(0, 3)
    .map((line) => line.ingredientName)
    .join(", ");
  const more =
    params.lines.length > 3 ? ` +${params.lines.length - 3}` : "";
  const head = [params.supplierName, date].filter(Boolean).join(" · ");
  const list = names ? `${names}${more}` : "keine Positionen";
  if (params.module !== "inventory_po_closed") {
    return `${head} · ${list}`;
  }
  const { missing, partial } = poStatusExceptionCounts(params.lines);
  const exception =
    missing === 0 && partial === 0
      ? "alles wie bestellt"
      : [
          missing > 0 ? `${missing} fehlend` : null,
          partial > 0 ? `${partial} abweichend` : null,
        ]
          .filter(Boolean)
          .join(", ");
  return `${head} · ${list} · ${exception}`;
}

export function formatPoStatusPushDetails(params: {
  module: PoStatusNotifyModuleId;
  supplierName: string;
  deliveryDate: unknown;
  staffName: string | null;
  lines: PoStatusLinePayload[];
}): string {
  const date = formatPoDeliveryDateDe(params.deliveryDate);
  const header = [
    `Lieferant: ${params.supplierName}`,
    date ? `Lieferdatum: ${date}` : null,
    params.staffName ? `Von: ${params.staffName}` : null,
  ].filter((line): line is string => Boolean(line));

  const positionLines = capLines(params.lines.map(formatPoStatusLine));
  const positions =
    positionLines.length > 0
      ? ["Positionen:", ...positionLines]
      : ["Positionen: keine"];

  if (params.module !== "inventory_po_closed") {
    return [...header, ...positions].join("\n");
  }

  const exceptions = params.lines
    .map(formatPoStatusException)
    .filter((line): line is string => Boolean(line));
  const exceptionBlock =
    exceptions.length === 0
      ? ["Abweichungen: keine — alles wie bestellt."]
      : ["Fehlend / abweichend:", ...capLines(exceptions)];

  return [...header, ...exceptionBlock, ...positions].join("\n");
}
