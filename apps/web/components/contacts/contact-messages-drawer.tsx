"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import type { ContactMessageRow } from "@/lib/supabase/contact-messages-db";
import { fetchContactMessagesQuick } from "@/lib/supabase/contact-messages-db";
import {
  fetchReservationById,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";

export function ContactMessagesDrawer({
  open,
  onOpenChange,
  restaurantId,
  contactId,
  contactName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  restaurantId: string;
  contactId: string;
  contactName: string;
}) {
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationForDrawer, setReservationForDrawer] =
    useState<ReservationListRow | null>(null);

  const load = useCallback(async () => {
    if (!open || !restaurantId || !contactId) return;
    const { data, error } = await fetchContactMessagesQuick(
      restaurantId,
      contactId,
    );
    if (error) toast.error(error.message);
    setMessages(data);
    setLoading(false);
  }, [open, restaurantId, contactId]);

  useLayoutEffect(() => {
    if (!open || !restaurantId || !contactId) {
      setLoading(false);
      setMessages([]);
      return;
    }
    setMessages([]);
    setLoading(true);
  }, [open, restaurantId, contactId]);

  useEffect(() => {
    void load();
  }, [load]);

  const openReservationFromMessage = useCallback(
    async (reservationId: string) => {
      const { data, error } = await fetchReservationById({
        restaurantId,
        id: reservationId,
      });
      if (error || !data) {
        toast.error("Reservierung nicht gefunden.");
        return;
      }
      setReservationForDrawer(data);
      setReservationDrawerOpen(true);
    },
    [restaurantId],
  );

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        direction="bottom"
        repositionInputs={false}
      >
        <DrawerContent className="mx-auto flex max-h-[min(88dvh,560px)] w-full max-w-2xl flex-col rounded-t-[1.75rem] border-0 bg-card shadow-elevated">
          <DrawerHeader className="shrink-0 px-6 pt-2 pb-2 text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              Verknüpfte Nachrichten
            </DrawerTitle>
            <DrawerDescription className="text-base">
              Nachrichten von „{contactName}“ (alle Kanäle).
            </DrawerDescription>
          </DrawerHeader>
          <div className="flex min-h-0 flex-1 flex-col px-6 pb-4">
          <ContactMessageChatViewport
            messages={messages}
            loading={loading}
            threadKey={contactId}
            onReservationOpen={(id) => void openReservationFromMessage(id)}
          />
          </div>
          <div className="border-t border-border/50 px-6 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Button
              type="button"
              variant="outline"
              className="h-11 w-full rounded-xl"
              render={
                <a href={`/dashboard/kontakte/nachrichten?contact=${contactId}`} />
              }
              onClick={() => onOpenChange(false)}
            >
              Im Nachrichten-Bereich öffnen
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      <ReservationEditDrawer
        open={reservationDrawerOpen}
        onOpenChange={(o) => {
          setReservationDrawerOpen(o);
          if (!o) setReservationForDrawer(null);
        }}
        reservation={reservationForDrawer}
        createFor={null}
        onSaved={() => {
          setReservationDrawerOpen(false);
          setReservationForDrawer(null);
          void load();
        }}
      />
    </>
  );
}
