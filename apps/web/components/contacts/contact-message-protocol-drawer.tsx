"use client";

import { useCallback, useEffect, useState } from "react";
import { DocumentsProtocolTableSkeleton } from "@/components/documents/documents-protocol-table-skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { DrawerFormSection } from "@/components/ui/drawer-form-section";
import { TableCellTruncateTooltip } from "@/components/ui/table-cell-truncate-tooltip";
import type { ContactMessageProtocolPayload } from "@/lib/contact-messages/contact-message-protocol-types";
import { CONTACT_MESSAGE_PLATFORM_LABELS } from "@/lib/constants/contact-message-platforms";
import type { ContactMessagePlatform } from "@/lib/constants/contact-message-platforms";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { drawerContentClassName } from "@/lib/ui/drawer-chrome";
import {
  drawerFormHeaderClassName,
  drawerScrollAreaClassName,
} from "@/lib/ui/drawer-form-section";
import { moduleDataTableHeadRowMutedClassName } from "@/lib/ui/module-data-table";

const whenFmt = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatWhen(iso: string | null): string {
  if (!iso) return "—";
  try {
    return whenFmt.format(new Date(iso));
  } catch {
    return iso;
  }
}

type ContactMessageProtocolDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string | null;
  messageId: string | null;
};

export function ContactMessageProtocolDrawer({
  open,
  onOpenChange,
  restaurantId,
  messageId,
}: ContactMessageProtocolDrawerProps) {
  const [payload, setPayload] = useState<ContactMessageProtocolPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const showSkeleton = useDeferredSkeleton(loading);

  const reload = useCallback(async () => {
    if (!restaurantId || !messageId) return;
    setLoading(true);
    try {
      const q = new URLSearchParams({ restaurantId, messageId });
      const res = await fetch(`/api/contact-messages/protocol?${q}`);
      const data = (await res.json()) as ContactMessageProtocolPayload & {
        error?: string;
      };
      if (!res.ok) {
        setPayload(null);
        return;
      }
      setPayload(data);
    } catch {
      setPayload(null);
    } finally {
      setLoading(false);
    }
  }, [restaurantId, messageId]);

  useEffect(() => {
    if (!open || !messageId) return;
    void reload();
  }, [open, messageId, reload]);

  const platformLabel =
    payload?.platform &&
    CONTACT_MESSAGE_PLATFORM_LABELS[payload.platform as ContactMessagePlatform]
      ? CONTACT_MESSAGE_PLATFORM_LABELS[
          payload.platform as ContactMessagePlatform
        ]
      : payload?.platform;

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="bottom" repositionInputs={false}>
      <DrawerContent className={drawerContentClassName("wide")}>
        <DrawerHeader className={drawerFormHeaderClassName(6)}>
          <DrawerTitle className="text-xl font-semibold tracking-tight">
            Nachrichtenprotokoll
          </DrawerTitle>
          <DrawerDescription className="text-sm leading-relaxed">
            {platformLabel ? `${platformLabel} · ` : null}
            {payload?.direction === "outbound" ? "Ausgehend" : "Eingehend"}
            {payload?.preview ? (
              <>
                {" "}
                ·{" "}
                <span className="text-muted-foreground">{payload.preview}</span>
              </>
            ) : null}
          </DrawerDescription>
        </DrawerHeader>
        <div className={drawerScrollAreaClassName("4-6")}>
          <DrawerFormSection contentPadding="4-6">
            {showSkeleton ? (
              <DocumentsProtocolTableSkeleton compact />
            ) : payload?.events.length ? (
              <div className="overflow-x-auto rounded-xl border border-border/50">
                <table className="w-full min-w-[20rem] text-sm">
                  <thead>
                    <tr className={moduleDataTableHeadRowMutedClassName}>
                      <th className="px-3 py-2.5 text-left font-medium">Zeit</th>
                      <th className="px-3 py-2.5 text-left font-medium">Ereignis</th>
                      <th className="px-3 py-2.5 text-left font-medium">Wer / Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/40">
                    {payload.events.map((event, index) => (
                      <tr key={`${event.kind}-${event.at ?? "na"}-${index}`}>
                        <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-muted-foreground">
                          {formatWhen(event.at)}
                        </td>
                        <td className="px-3 py-2.5 font-medium">{event.label}</td>
                        <td className="max-w-[14rem] px-3 py-2.5 text-muted-foreground">
                          <TableCellTruncateTooltip
                            text={
                              [event.actorName, event.detail]
                                .filter(Boolean)
                                .join(" · ") || "—"
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Keine Protokolldaten für diese Nachricht.
              </p>
            )}
            {!loading && payload?.events.some((e) => !e.at) ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Einige Kanal-Statuswerte (z. B. WhatsApp gelesen) haben keinen
                gespeicherten Zeitpunkt.
              </p>
            ) : null}
          </DrawerFormSection>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
