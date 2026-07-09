"use client";

import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { toast } from "sonner";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { ContactMessageComposer } from "@/components/contacts/contact-message-composer";
import {
  sendContactMessageUserMessage,
  triggerSendContactMessage,
} from "@/lib/contact-messages/trigger-send-contact-message";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import {
  fetchReservationContactMessages,
  type ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";

export function ReservationMessagesPanel({
  restaurantId,
  reservationId,
  contactId,
  restaurantName,
  hasPhone,
  hasEmail,
  defaultSendWhatsapp,
  defaultSendEmail,
}: {
  restaurantId: string;
  reservationId: string;
  contactId: string | null;
  restaurantName?: string;
  hasPhone: boolean;
  hasEmail: boolean;
  defaultSendWhatsapp?: boolean;
  defaultSendEmail?: boolean;
}) {
  const { whatsappEnabled, emailEnabled, whatsappConnected, emailConnected } =
    useRestaurantChannelConnections(restaurantId);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    if (!restaurantId || !reservationId) return;
    const { data, error } = await fetchReservationContactMessages({
      restaurantId,
      reservationId,
    });
    if (error) toast.error(error.message);
    setMessages(data);
    setLoading(false);
  }, [restaurantId, reservationId]);

  useLayoutEffect(() => {
    if (!restaurantId || !reservationId) {
      setLoading(false);
      setMessages([]);
      return;
    }
    setMessages([]);
    setLoading(true);
  }, [restaurantId, reservationId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleSend = async ({
    body,
    sendWhatsapp,
    sendEmail,
    files,
  }: {
    body: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
    files?: File[];
  }) => {
    if (!contactId) {
      toast.error(
        "Kein Kontakt verknüpft — Nachricht kann nur in Gwada gespeichert werden, wenn ein Kontakt existiert.",
      );
      return;
    }
    const channels: ("gwada" | "whatsapp" | "email")[] = ["gwada"];
    if (sendWhatsapp) channels.push("whatsapp");
    if (sendEmail) channels.push("email");

    setSending(true);
    const result = await triggerSendContactMessage({
      restaurantId,
      contactId,
      messageBody: body,
      direction: "outbound",
      channels,
      reservationId,
      restaurantName,
      files,
    });
    setSending(false);

    const warn = sendContactMessageUserMessage(result);
    if (warn) toast.warning(warn);
    else if (result?.ok) toast.success("Nachricht gesendet.");
    else toast.error("Senden fehlgeschlagen.");

    void load();
  };

  return (
    <div className="min-w-0 space-y-3 overflow-x-hidden rounded-xl border border-border/50 bg-muted/10 px-3 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Nachrichtenverlauf
      </p>
      <ContactMessageChatViewport
        messages={messages}
        loading={loading}
        threadKey={reservationId}
        className="max-h-[min(28dvh,220px)] overflow-x-hidden overscroll-x-none"
      />
      {contactId ? (
        <ContactMessageComposer
          disabled={loading}
          sending={sending}
          hasPhone={hasPhone}
          hasEmail={hasEmail}
          whatsappEnabled={whatsappEnabled && whatsappConnected}
          emailEnabled={emailEnabled && emailConnected}
          defaultSendWhatsapp={defaultSendWhatsapp}
          defaultSendEmail={defaultSendEmail}
          onSend={handleSend}
          placeholder="Antwort an den Gast …"
        />
      ) : (
        <p className="text-xs text-muted-foreground">
          Verknüpfen Sie einen Kontakt (E-Mail oder Telefon), um den Chat zu
          nutzen.
        </p>
      )}
    </div>
  );
}
