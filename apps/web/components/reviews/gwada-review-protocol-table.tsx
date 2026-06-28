"use client";

import Link from "next/link";
import type { GwadaReviewProtocolEvent } from "@/lib/reviews/gwada-review-protocol-types";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string) {
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

export function eventKindLabel(kind: string): string {
  switch (kind) {
    case "reservation":
      return "Reservierung";
    case "invitation_created":
      return "Einladung";
    case "link_sent":
    case "message_sent":
      return "Versand";
    case "review_submitted":
      return "Bewertung";
    default:
      return "Ereignis";
  }
}

export function GwadaReviewProtocolTable({
  events,
  onNavigate,
}: {
  events: GwadaReviewProtocolEvent[];
  onNavigate?: () => void;
}) {
  if (events.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Keine Protokolleinträge.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/50">
      <table className="w-full min-w-[720px] table-fixed text-left text-xs sm:text-sm">
        <thead>
          <tr className={moduleDataTableHeadRowMutedClassName}>
            <th className="whitespace-nowrap px-2 py-2 sm:px-3">Datum</th>
            <th className="min-w-[6rem] px-2 py-2 sm:px-3">Art</th>
            <th className="min-w-[7rem] px-2 py-2 sm:px-3">Nutzer</th>
            <th className="min-w-[12rem] px-2 py-2 sm:px-3">Details</th>
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border/40 last:border-0">
              <td className="whitespace-nowrap px-2 py-2.5 text-muted-foreground sm:px-3">
                {formatWhen(e.at)}
              </td>
              <td className="px-2 py-2.5 sm:px-3">{eventKindLabel(e.kind)}</td>
              <td className="max-w-[7rem] px-2 py-2.5 text-muted-foreground sm:px-3">
                <TableCellTruncateTooltip text={e.actorName ?? "—"} />
              </td>
              <td className="px-2 py-2.5 sm:px-3">
                <div className="min-w-0 space-y-0.5">
                  <p className="font-medium text-foreground">
                    <TableCellTruncateTooltip text={e.title} />
                  </p>
                  {e.description ? (
                    <p className="text-muted-foreground">
                      <TableCellTruncateTooltip text={e.description} />
                    </p>
                  ) : null}
                  {e.href && e.hrefLabel ? (
                    <Link
                      href={e.href}
                      className="text-xs font-medium text-accent underline-offset-2 hover:underline"
                      onClick={onNavigate}
                    >
                      {e.hrefLabel}
                    </Link>
                  ) : null}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
