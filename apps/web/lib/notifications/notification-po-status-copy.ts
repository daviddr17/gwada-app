import { escapeHtml } from "@/lib/email/escape-html";

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

const EMAIL_FONT =
  "-apple-system,BlinkMacSystemFont,'SF Pro Text','Helvetica Neue',Helvetica,Arial,sans-serif";

function emailSectionTitle(label: string): string {
  return `<p style="margin:0 0 8px;font-family:${EMAIL_FONT};font-size:13px;font-weight:600;line-height:1.3;color:#1d1d1f;">${escapeHtml(label)}</p>`;
}

function emailCell(
  html: string,
  options?: { header?: boolean; align?: "left" | "right"; nowrap?: boolean },
): string {
  const header = options?.header === true;
  const align = options?.align ?? "left";
  const nowrap = options?.nowrap ? "white-space:nowrap;" : "";
  return `<td style="padding:8px 10px;border-bottom:1px solid #e8e8ed;font-family:${EMAIL_FONT};font-size:${header ? "11px" : "14px"};font-weight:${header ? "600" : "400"};line-height:1.35;letter-spacing:${header ? "0.02em" : "0"};color:${header ? "#6e6e73" : "#1d1d1f"};text-align:${align};vertical-align:top;${header ? "background-color:#f5f5f7;" : ""}${nowrap}">${html}</td>`;
}

function emailTable(
  headers: Array<{ label: string; align?: "left" | "right"; nowrap?: boolean }>,
  rows: string[][],
): string {
  const head = `<tr>${headers
    .map((header) =>
      emailCell(escapeHtml(header.label), {
        header: true,
        align: header.align,
        nowrap: header.nowrap,
      }),
    )
    .join("")}</tr>`;
  const body = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell, index) =>
            emailCell(cell, {
              align: headers[index]?.align,
              nowrap: headers[index]?.nowrap,
            }),
          )
          .join("")}</tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="width:100%;border-collapse:collapse;margin:0 0 18px;">${head}${body}</table>`;
}

function articleCell(line: PoStatusLinePayload): string {
  const name = escapeHtml(line.ingredientName);
  if (!line.brandLabel) return name;
  return `${name}<br /><span style="color:#6e6e73;font-size:12px;">${escapeHtml(line.brandLabel)}</span>`;
}

function dash(value: string | null | undefined): string {
  const text = value?.trim();
  return text ? escapeHtml(text) : "—";
}

function statusCell(status: string | null): string {
  if (status === "not_delivered") {
    return `<span style="color:#b42318;">Fehlend</span>`;
  }
  if (status === "partial") {
    return `<span style="color:#b54708;">Abweichend</span>`;
  }
  if (status === "delivered") {
    return `<span style="color:#067647;">Geliefert</span>`;
  }
  return "—";
}

function cappedPoLines(lines: PoStatusLinePayload[]): {
  shown: PoStatusLinePayload[];
  more: number;
} {
  if (lines.length <= PUSH_LINE_CAP) return { shown: lines, more: 0 };
  return { shown: lines.slice(0, PUSH_LINE_CAP), more: lines.length - PUSH_LINE_CAP };
}

function moreRowsNote(more: number): string {
  if (more <= 0) return "";
  return `<p style="margin:-6px 0 16px;font-family:${EMAIL_FONT};font-size:13px;line-height:1.4;color:#6e6e73;">… und ${more} weitere</p>`;
}

/** E-Mail-Körper: Positionen als Tabelle, damit Menge und Einheit nicht in der Fließzeile verrutschen. */
export function formatPoStatusEmailBodyHtml(params: {
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
  const headerHtml = `<p style="margin:0 0 16px;font-family:${EMAIL_FONT};font-size:15px;line-height:1.5;color:#1d1d1f;">${header
    .map((line) => escapeHtml(line))
    .join("<br />\n")}</p>`;

  const { shown, more } = cappedPoLines(params.lines);
  const positionHeaders = [
    { label: "Artikel" },
    { label: "Art.-Nr.", nowrap: true },
    { label: "Menge", align: "right" as const, nowrap: true },
    { label: "Einheit", nowrap: true },
  ];
  const positionRows =
    shown.length > 0
      ? shown.map((line) => [
          articleCell(line),
          dash(line.articleNumber),
          escapeHtml(line.quantityLabel),
          dash(line.unitLabel),
        ])
      : [];

  if (params.module !== "inventory_po_closed") {
    const table =
      positionRows.length > 0
        ? `${emailSectionTitle("Positionen")}${emailTable(positionHeaders, positionRows)}${moreRowsNote(more)}`
        : `<p style="margin:0;font-family:${EMAIL_FONT};font-size:15px;color:#1d1d1f;">Positionen: keine</p>`;
    return `${headerHtml}${table}`;
  }

  const { shown: exceptions, more: exceptionMore } = cappedPoLines(
    params.lines.filter(
      (line) =>
        line.deliveryStatus === "not_delivered" ||
        line.deliveryStatus === "partial",
    ),
  );
  const exceptionHtml =
    exceptions.length === 0
      ? `<p style="margin:0 0 16px;font-family:${EMAIL_FONT};font-size:15px;line-height:1.45;color:#1d1d1f;">Abweichungen: keine — alles wie bestellt.</p>`
      : `${emailSectionTitle("Fehlend / abweichend")}${emailTable(
          [
            { label: "Artikel" },
            { label: "Bestellt", align: "right", nowrap: true },
            { label: "Geliefert", align: "right", nowrap: true },
            { label: "Hinweis" },
          ],
          exceptions.map((line) => [
            articleCell(line),
            escapeHtml(qtyWithUnit(line.quantityLabel, line.unitLabel)),
            line.deliveredQuantityLabel
              ? escapeHtml(qtyWithUnit(line.deliveredQuantityLabel, line.unitLabel))
              : "—",
            dash(line.deliveryNote),
          ]),
        )}${moreRowsNote(exceptionMore)}`;

  const statusHeaders = [
    ...positionHeaders,
    { label: "Status", nowrap: true },
  ];
  const statusRows = shown.map((line) => [
    articleCell(line),
    dash(line.articleNumber),
    escapeHtml(line.quantityLabel),
    dash(line.unitLabel),
    statusCell(line.deliveryStatus),
  ]);
  const positionsHtml =
    statusRows.length > 0
      ? `${emailSectionTitle("Positionen")}${emailTable(statusHeaders, statusRows)}${moreRowsNote(more)}`
      : `<p style="margin:0;font-family:${EMAIL_FONT};font-size:15px;color:#1d1d1f;">Positionen: keine</p>`;

  return `${headerHtml}${exceptionHtml}${positionsHtml}`;
}
