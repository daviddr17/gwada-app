"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  MailOpen,
  Mail,
  MoreVertical,
  Plus,
  RefreshCw,
  UserPlus,
  UserRound,
} from "lucide-react";
import { ContactConversationsListSkeleton } from "@/components/contacts/contact-conversations-list-skeleton";
import { ContactConversationsReadFilter } from "@/components/contacts/contact-conversations-read-filter";
import { ContactConversationsSearchBar } from "@/components/contacts/contact-conversations-search-bar";
import { toast } from "sonner";
import { ContactEditDrawer } from "@/components/contacts/contact-edit-drawer";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import { ContactMessageComposer } from "@/components/contacts/contact-message-composer";
import { ContactMessagePlatformChip } from "@/components/contacts/contact-message-platform-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CONTACT_MESSAGE_PLATFORM_LABELS,
  CONTACT_MESSAGE_PLATFORM_ORDER,
  isContactMessagePlatform,
  type ContactMessagePlatform,
} from "@/lib/constants/contact-message-platforms";
import {
  fetchEmailConversationsClient,
  fetchEmailMessagesClient,
  fetchWahaConversationsClient,
  fetchWahaMessagesClient,
  fetchWahaDisplayNameClient,
  fetchWahaResolvedPhoneClient,
  markConversationReadClient,
  markConversationUnreadClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { enrichConversationsWithReadState } from "@/lib/contact-messages/enrich-gwada-conversations-client";
import {
  filterConversationsByRead,
  filterContactConversations,
  type ConversationReadFilter,
} from "@/lib/contact-messages/filter-conversations";
import { draftFromEmailChat } from "@/lib/contact-messages/draft-from-email-chat";
import {
  draftFromWahaChat,
  type ContactCreateDraft,
} from "@/lib/contact-messages/draft-from-waha-chat";
import {
  emailAddressFromPseudoContactId,
  isEmailPseudoContactId,
} from "@/lib/contact-messages/email-pseudo-contact";
import {
  sendContactMessageUserMessage,
  triggerEmailInboxSend,
  triggerLinkWahaThreadToContact,
  triggerSendContactMessage,
  triggerWahaSendMessage,
} from "@/lib/contact-messages/trigger-send-contact-message";
import {
  isWhatsAppJidOrRawNumberLabel,
  needsWahaDisplayNameResolve,
  wahaConversationDisplayName,
} from "@/lib/contact-messages/waha-chat-label";
import {
  isWahaPseudoContactId,
  wahaChatIdFromPseudoContactId,
} from "@/lib/contact-messages/whatsapp-pseudo-contact";
import {
  phoneSubtitleFromChatId,
  resolveWhatsAppThreadPhoneSubtitle,
} from "@/lib/contact-messages/whatsapp-thread-phone-subtitle";
import {
  COUNTRIES_REFERENCE_FALLBACK,
  resolveCountryIso2FromLabel,
} from "@/lib/constants/countries";
import {
  normalizeContactEmail,
  normalizeContactPhone,
} from "@/lib/contacts/normalize-contact-identity";
import { formatGuestPhone } from "@/lib/phone/guest-phone";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  contactThreadDisplayName,
  fetchContactById,
  findContactByEmailNormalized,
  findContactByPhoneNormalized,
  primaryEmail,
  primaryPhone,
} from "@/lib/supabase/contacts-db";
import {
  fetchContactConversations,
  fetchContactMessages,
  type ContactConversationPreview,
  type ContactMessageRow,
} from "@/lib/supabase/contact-messages-db";
import type { ContactListRow } from "@/lib/supabase/contacts-db";
import {
  fetchReservationById,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { cn } from "@/lib/utils";

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function previewSnippet(body: string, max = 72): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Verknüpfter Kontakt in der DB (kein WAHA-/E-Mail-Pseudo-Chat). */
function isLinkedContactId(contactId: string): boolean {
  return (
    isUuidRestaurantId(contactId) &&
    !isWahaPseudoContactId(contactId) &&
    !isEmailPseudoContactId(contactId)
  );
}

function isInboxPseudoContactId(contactId: string): boolean {
  return (
    isWahaPseudoContactId(contactId) || isEmailPseudoContactId(contactId)
  );
}

type PendingInboxLink = {
  platform: "whatsapp" | "email";
  pseudoContactId: string;
};

function platformInferredFromContact(
  contactId: string | null,
): ContactMessagePlatform | null {
  if (!contactId) return null;
  if (isWahaPseudoContactId(contactId)) return "whatsapp";
  if (isEmailPseudoContactId(contactId)) return "email";
  return null;
}

function resolveMessagesPlatform(
  platformParam: string | null,
  contactParam: string | null,
): ContactMessagePlatform {
  const inferred = platformInferredFromContact(contactParam);
  if (inferred) return inferred;
  if (platformParam && isContactMessagePlatform(platformParam)) {
    return platformParam;
  }
  return "gwada";
}

export function ContactsMessagesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactParam = searchParams.get("contact");
  const platformParam = searchParams.get("platform");

  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const { profile } = useRestaurantProfile();
  const defaultCountryIso2 = useMemo(
    () => resolveCountryIso2FromLabel(profile.country),
    [profile.country],
  );
  const {
    loading: connectionsLoading,
    whatsappConnected,
    emailConnected,
    whatsappEnabled,
    emailEnabled,
    facebookEnabled,
    facebookConnected,
  } = useRestaurantChannelConnections(restaurantId);

  const [platform, setPlatform] = useState<ContactMessagePlatform>(() =>
    resolveMessagesPlatform(platformParam, contactParam),
  );
  const [conversations, setConversations] = useState<
    ContactConversationPreview[]
  >([]);
  const [messages, setMessages] = useState<ContactMessageRow[]>([]);
  const [contactName, setContactName] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [sending, setSending] = useState(false);
  const [inboxHint, setInboxHint] = useState<string | null>(null);
  const [whatsappThreadPhone, setWhatsappThreadPhone] = useState<string | null>(
    null,
  );
  const [contactDrawerOpen, setContactDrawerOpen] = useState(false);
  const [editContactId, setEditContactId] = useState<string | null>(null);
  const [contactCreateDraft, setContactCreateDraft] =
    useState<ContactCreateDraft | null>(null);
  const [pendingInboxLink, setPendingInboxLink] =
    useState<PendingInboxLink | null>(null);
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationForDrawer, setReservationForDrawer] =
    useState<ReservationListRow | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [readFilter, setReadFilter] = useState<ConversationReadFilter>("all");
  const [refreshingInbox, setRefreshingInbox] = useState(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    setChatSearch("");
    setReadFilter("all");
  }, [platform]);

  const filteredConversations = useMemo(() => {
    const searched = filterContactConversations(conversations, chatSearch);
    return filterConversationsByRead(searched, readFilter);
  }, [conversations, chatSearch, readFilter]);

  const whatsappHeaderSubtitle = useMemo(() => {
    if (platform !== "whatsapp") return null;
    const loaded = whatsappThreadPhone?.trim();
    if (loaded) return loaded;

    if (contactParam && isWahaPseudoContactId(contactParam)) {
      const chatId = wahaChatIdFromPseudoContactId(contactParam);
      if (chatId) {
        const fromChat = phoneSubtitleFromChatId(chatId, defaultCountryIso2);
        if (fromChat) return fromChat;
      }
    }

    const name = contactName.trim();
    if (name.startsWith("+")) return name;

    return null;
  }, [
    platform,
    contactParam,
    whatsappThreadPhone,
    contactName,
    defaultCountryIso2,
  ]);

  const showWhatsAppMissingPhoneHint = useMemo(() => {
    if (platform !== "whatsapp" || loadingThread || whatsappHeaderSubtitle) {
      return false;
    }
    const name = contactName.trim();
    if (!name) return true;
    return (
      needsWahaDisplayNameResolve(name) || isWhatsAppJidOrRawNumberLabel(name)
    );
  }, [platform, loadingThread, whatsappHeaderSubtitle, contactName]);

  const unreadInList = useMemo(
    () => conversations.reduce((n, c) => n + (c.is_unread ? c.unread_count : 0), 0),
    [conversations],
  );

  const showListSkeleton = useDeferredSkeleton(loadingList);

  const showConversationList =
    !contactParam &&
    (platform === "gwada" ||
      (platform === "whatsapp" && whatsappConnected) ||
      (platform === "email" && emailConnected));

  const isPlatformAvailable = useCallback(
    (p: ContactMessagePlatform): boolean => {
      if (p === "gwada") return true;
      if (p === "whatsapp") return whatsappConnected;
      if (p === "email") return emailConnected;
      if (p === "facebook") return facebookEnabled;
      return false;
    },
    [whatsappConnected, emailConnected, facebookEnabled, facebookConnected],
  );

  useEffect(() => {
    if (connectionsLoading || !workspaceReady || !restaurantId) return;

    const inferred = platformInferredFromContact(contactParam);
    const requested = resolveMessagesPlatform(platformParam, contactParam);

    const explicitInboxTab =
      platformParam === "whatsapp" ||
      platformParam === "email" ||
      platformParam === "facebook";

    let resolved = requested;
    if (!isPlatformAvailable(requested)) {
      if (inferred && contactParam) {
        resolved = inferred;
      } else if (explicitInboxTab) {
        resolved = requested;
      } else {
        resolved =
          CONTACT_MESSAGE_PLATFORM_ORDER.find((p) => isPlatformAvailable(p)) ??
          "gwada";
      }
    }

    setPlatform((prev) => (prev === resolved ? prev : resolved));

    const needsPlatformInUrl =
      platformParam !== resolved ||
      (inferred && !platformParam) ||
      (contactParam && !searchParams.get("contact"));

    if (needsPlatformInUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("platform", resolved);
      if (contactParam) params.set("contact", contactParam);
      router.replace(`/kontakte/nachrichten?${params.toString()}`);
    }
  }, [
    connectionsLoading,
    workspaceReady,
    restaurantId,
    platformParam,
    contactParam,
    whatsappConnected,
    emailConnected,
    isPlatformAvailable,
    router,
    searchParams,
  ]);

  const loadConversations = useCallback(async (opts?: { silent?: boolean }) => {
    if (!restaurantId) {
      setConversations([]);
      setLoadingList(false);
      return;
    }
    if (!opts?.silent) setLoadingList(true);
    setInboxHint(null);

    if (platform === "whatsapp" && whatsappConnected) {
      const { data, error } = await fetchWahaConversationsClient(restaurantId);
      if (error) {
        toast.error(
          error === "waha_not_configured"
            ? "WAHA ist nicht konfiguriert."
            : `WhatsApp-Chats konnten nicht geladen werden: ${error}`,
        );
        setConversations([]);
      } else {
        setConversations(
          data.map((c) => ({
            ...c,
            contact_name: wahaConversationDisplayName(c),
          })),
        );
      }
    } else if (platform === "email" && emailConnected) {
      const { data, error } = await fetchEmailConversationsClient(restaurantId);
      if (error) {
        toast.error(
          error === "imap_not_configured"
            ? "E-Mail-Konto nicht verbunden."
            : `E-Mail-Postfach konnte nicht geladen werden: ${error}`,
        );
        setConversations([]);
      } else {
        setConversations(data);
      }
    } else {
      const { data, error } = await fetchContactConversations({
        restaurantId,
        platform,
      });
      if (error) toast.error(error.message);
      const enriched = await enrichConversationsWithReadState({
        restaurantId,
        platform,
        conversations: data,
      });
      setConversations(enriched);
      setInboxHint(
        platform === "gwada"
          ? "Alle Kanäle – Nachrichten aus Gwada, WhatsApp und E-Mail an einem Ort."
          : null,
      );
    }

    setLoadingList(false);
  }, [restaurantId, platform, whatsappConnected, emailConnected]);

  const refreshInbox = useCallback(async () => {
    setRefreshingInbox(true);
    await loadConversations({ silent: true });
    setRefreshingInbox(false);
  }, [loadConversations]);

  const showInboxRefresh =
    !contactParam &&
    ((platform === "whatsapp" && whatsappConnected) ||
      (platform === "email" && emailConnected));

  const patchConversationReadState = useCallback(
    (contactId: string, isUnread: boolean, unreadCount = 0) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.contact_id === contactId
            ? { ...c, is_unread: isUnread, unread_count: unreadCount }
            : c,
        ),
      );
    },
    [],
  );

  const markConversationRead = useCallback(
    async (conversationKey: string) => {
      if (!restaurantId) return;
      const { ok, error } = await markConversationReadClient({
        restaurantId,
        conversationKey,
        platform,
      });
      if (!ok && error) {
        toast.error(`Als gelesen markieren: ${error}`);
        return;
      }
      patchConversationReadState(conversationKey, false, 0);
    },
    [restaurantId, platform, patchConversationReadState],
  );

  const markConversationUnread = useCallback(
    async (conversationKey: string) => {
      if (!restaurantId) return;
      const { ok, error } = await markConversationUnreadClient({
        restaurantId,
        conversationKey,
        platform,
      });
      if (!ok && error) {
        toast.error(`Als ungelesen markieren: ${error}`);
        return;
      }
      patchConversationReadState(conversationKey, true, 1);
    },
    [restaurantId, platform, patchConversationReadState],
  );

  const loadThread = useCallback(async () => {
    if (!restaurantId || !contactParam) {
      setMessages([]);
      setWhatsappThreadPhone(null);
      setLoadingThread(false);
      return;
    }
    if (platform !== "whatsapp") {
      setWhatsappThreadPhone(null);
    }
    setLoadingThread(true);
    setInboxHint(null);
    let threadLoaded = false;

    const effectivePlatform =
      platformInferredFromContact(contactParam) ?? platform;

    if (effectivePlatform === "email" && emailConnected) {
      const { data, error } = await fetchEmailMessagesClient({
        restaurantId,
        contactId: contactParam,
      });
      if (error) {
        toast.error(`E-Mail-Verlauf: ${error}`);
        setMessages([]);
      } else {
        setMessages(data);
        setInboxHint("Verlauf aus dem verbundenen E-Mail-Postfach.");
        threadLoaded = true;
      }
      if (
        !isEmailPseudoContactId(contactParam) &&
        !isWahaPseudoContactId(contactParam)
      ) {
        const { data: contact } = await fetchContactById({
          restaurantId,
          contactId: contactParam,
        });
        if (contact) {
          setContactName(contactThreadDisplayName(contact));
          setHasPhone(Boolean(primaryPhone(contact)?.trim()));
          setHasEmail(Boolean(primaryEmail(contact)?.trim()));
        }
      } else {
        const conv = conversationsRef.current.find(
          (c) => c.contact_id === contactParam,
        );
        setContactName(conv?.contact_name ?? "E-Mail");
        setHasPhone(false);
        setHasEmail(true);
      }
    } else if (effectivePlatform === "whatsapp" && whatsappConnected) {
      const { data, error } = await fetchWahaMessagesClient({
        restaurantId,
        contactId: contactParam,
      });
      if (error) {
        toast.error(`WhatsApp-Verlauf: ${error}`);
        setMessages([]);
      } else {
        setMessages(data);
        threadLoaded = true;
      }

      let resolvedName = contactName;
      let contactRow: ContactListRow | null = null;

      if (!isWahaPseudoContactId(contactParam)) {
        const { data: contact } = await fetchContactById({
          restaurantId,
          contactId: contactParam,
        });
        if (contact) {
          contactRow = contact;
          resolvedName = contactThreadDisplayName(contact);
          setContactName(resolvedName);
          setHasPhone(Boolean(primaryPhone(contact)?.trim()));
          setHasEmail(Boolean(primaryEmail(contact)?.trim()));
        }
      } else {
        const conv = conversationsRef.current.find(
          (c) => c.contact_id === contactParam,
        );
        const chatId = wahaChatIdFromPseudoContactId(contactParam);
        let name = wahaConversationDisplayName({
          contact_id: contactParam,
          contact_name: conv?.contact_name ?? "WhatsApp",
        });
        if (chatId && needsWahaDisplayNameResolve(name)) {
          const { displayName } = await fetchWahaDisplayNameClient({
            restaurantId,
            chatId,
          });
          if (displayName && !needsWahaDisplayNameResolve(displayName)) {
            name = displayName;
          }
        }
        resolvedName = name;
        setContactName(name);
        setHasPhone(true);
        setHasEmail(false);
      }

      setWhatsappThreadPhone(
        await resolveWhatsAppThreadPhoneSubtitle({
          restaurantId,
          contactId: contactParam,
          defaultCountryIso2,
          conversationDisplayName: resolvedName,
          contact: contactRow,
          fetchResolvedPhone: fetchWahaResolvedPhoneClient,
        }),
      );
    } else if (
      !isWahaPseudoContactId(contactParam) &&
      !isEmailPseudoContactId(contactParam)
    ) {
      const [{ data: msgs, error: msgErr }, { data: contact }] =
        await Promise.all([
          fetchContactMessages({
            restaurantId,
            contactId: contactParam,
            platform: effectivePlatform === "gwada" ? "gwada" : platform,
          }),
          isWahaPseudoContactId(contactParam) ||
          isEmailPseudoContactId(contactParam)
            ? Promise.resolve({ data: null, error: null })
            : fetchContactById({ restaurantId, contactId: contactParam }),
        ]);
      if (msgErr) toast.error(msgErr.message);
      else threadLoaded = true;
      setMessages(msgs);
      if (contact) {
        setContactName(contactThreadDisplayName(contact));
        setHasPhone(Boolean(primaryPhone(contact)?.trim()));
        setHasEmail(Boolean(primaryEmail(contact)?.trim()));
      }
    } else if (isWahaPseudoContactId(contactParam)) {
      const conv = conversationsRef.current.find(
        (c) => c.contact_id === contactParam,
      );
      setContactName(
        wahaConversationDisplayName({
          contact_id: contactParam,
          contact_name: conv?.contact_name ?? "WhatsApp",
        }),
      );
      setMessages([]);
    } else if (isEmailPseudoContactId(contactParam)) {
      const conv = conversationsRef.current.find(
        (c) => c.contact_id === contactParam,
      );
      setContactName(conv?.contact_name ?? "E-Mail");
      setMessages([]);
    }

    setLoadingThread(false);

    if (threadLoaded) {
      void markConversationRead(contactParam);
    }
  }, [
    restaurantId,
    contactParam,
    platform,
    whatsappConnected,
    emailConnected,
    markConversationRead,
    defaultCountryIso2,
  ]);

  useEffect(() => {
    if (connectionsLoading) return;
    if (contactParam) {
      void loadThread();
    } else {
      void loadConversations();
    }
  }, [
    contactParam,
    connectionsLoading,
    loadThread,
    loadConversations,
  ]);

  const selectPlatform = (p: ContactMessagePlatform) => {
    if (!isPlatformAvailable(p)) return;
    setPlatform(p);
    const params = new URLSearchParams();
    params.set("platform", p);
    router.replace(`/kontakte/nachrichten?${params.toString()}`);
  };

  const canOpenLinkedContact = useCallback(
    (contactId: string) => {
      if (!isLinkedContactId(contactId)) return false;
      if (platform === "gwada") return true;
      if (platform === "whatsapp" && whatsappConnected) return true;
      if (platform === "email" && emailConnected) return true;
      return false;
    },
    [platform, whatsappConnected, emailConnected],
  );

  const openLinkedContact = useCallback(
    (contactId: string) => {
      if (!canOpenLinkedContact(contactId)) return;
      setContactCreateDraft(null);
      setPendingInboxLink(null);
      setEditContactId(contactId);
      setContactDrawerOpen(true);
    },
    [canOpenLinkedContact],
  );

  const openReservationFromMessage = useCallback(
    async (reservationId: string) => {
      if (!restaurantId) return;
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

  const linkWahaThreadToExistingContact = useCallback(
    async (
      pseudoContactId: string,
      existingContactId: string,
      existingDisplayName: string,
    ) => {
      if (!restaurantId) return false;
      const link = await triggerLinkWahaThreadToContact({
        restaurantId,
        wahaContactId: pseudoContactId,
        contactId: existingContactId,
      });
      if (link?.ok) {
        const n = link.imported ?? 0;
        toast.success(
          n > 0
            ? `Chat mit „${existingDisplayName}“ verknüpft (${n} Nachrichten importiert).`
            : `Chat mit „${existingDisplayName}“ verknüpft.`,
        );
        router.replace(
          `/kontakte/nachrichten?platform=gwada&contact=${existingContactId}`,
        );
        return true;
      }
      toast.warning("Verknüpfung mit bestehendem Kontakt fehlgeschlagen.");
      return false;
    },
    [restaurantId, router],
  );

  const openCreateContactFromPseudo = useCallback(
    (pseudoContactId: string, displayName: string) => {
      if (!restaurantId || !isInboxPseudoContactId(pseudoContactId)) return;

      if (isWahaPseudoContactId(pseudoContactId)) {
        const chatId = wahaChatIdFromPseudoContactId(pseudoContactId);
        if (!chatId) return;

        void (async () => {
          const { phoneForParse, lidUnresolved } =
            await fetchWahaResolvedPhoneClient({ restaurantId, chatId });

          if (lidUnresolved) {
            toast.warning(
              "Telefonnummer nicht verfügbar (WhatsApp LID). Bitte Nummer manuell eintragen — der Chat bleibt über WhatsApp erreichbar.",
            );
          }

          const draft = draftFromWahaChat({
            chatId,
            displayName,
            defaultCountryIso2,
            countries: COUNTRIES_REFERENCE_FALLBACK,
            resolvedPhoneForParse: phoneForParse,
          });

          const phoneDraft = draft.phones?.[0];
          if (phoneDraft?.local) {
            const phoneDisplay = formatGuestPhone(
              phoneDraft.iso2,
              phoneDraft.local,
              COUNTRIES_REFERENCE_FALLBACK,
            );
            const norm = phoneDisplay
              ? normalizeContactPhone(phoneDisplay)
              : null;
            if (norm) {
              try {
                const existing = await findContactByPhoneNormalized({
                  restaurantId,
                  phoneNormalized: norm,
                });
                if (existing) {
                  await linkWahaThreadToExistingContact(
                    pseudoContactId,
                    existing.contactId,
                    existing.displayName,
                  );
                  return;
                }
              } catch {
                /* Drawer öffnen */
              }
            }
          }

          setPendingInboxLink({
            platform: "whatsapp",
            pseudoContactId,
          });
          setContactCreateDraft(draft);
          setEditContactId(null);
          setContactDrawerOpen(true);
        })();
        return;
      }

      const email = emailAddressFromPseudoContactId(pseudoContactId);
      if (!email) return;

      void (async () => {
        const emailNorm = normalizeContactEmail(email);
        if (emailNorm) {
          try {
            const existing = await findContactByEmailNormalized({
              restaurantId,
              emailNormalized: emailNorm,
            });
            if (existing) {
              toast.info(
                `E-Mail ist bereits bei „${existing.displayName}“ hinterlegt — bestehender Kontakt wird geöffnet.`,
              );
              router.replace(
                `/kontakte/nachrichten?platform=gwada&contact=${existing.contactId}`,
              );
              return;
            }
          } catch {
            /* Drawer öffnen */
          }
        }

        setPendingInboxLink({ platform: "email", pseudoContactId });
        setContactCreateDraft(draftFromEmailChat({ email, displayName }));
        setEditContactId(null);
        setContactDrawerOpen(true);
      })();
    },
    [
      defaultCountryIso2,
      linkWahaThreadToExistingContact,
      restaurantId,
      router,
    ],
  );

  const openConversation = (contactId: string) => {
    const params = new URLSearchParams();
    params.set("platform", platform);
    params.set("contact", contactId);
    router.push(`/kontakte/nachrichten?${params.toString()}`);
  };

  const backToList = () => {
    router.push(`/kontakte/nachrichten?platform=${platform}`);
  };

  const restaurantName = profile.name.trim() || undefined;
  const canReply =
    contactParam != null &&
    (platform === "whatsapp"
      ? whatsappConnected
      : platform === "email"
        ? emailConnected
        : !isWahaPseudoContactId(contactParam) &&
          !isEmailPseudoContactId(contactParam));

  const handleSend = async ({
    body,
    sendWhatsapp,
    sendEmail,
  }: {
    body: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
  }) => {
    if (!restaurantId || !contactParam || !canReply) return;

    setSending(true);

    if (platform === "whatsapp") {
      const result = isWahaPseudoContactId(contactParam)
        ? await triggerWahaSendMessage({
            restaurantId,
            wahaContactId: contactParam,
            messageBody: body,
          })
        : await triggerWahaSendMessage({
            restaurantId,
            contactId: contactParam,
            messageBody: body,
            storeUnderContact: true,
          });
      setSending(false);
      const warn = sendContactMessageUserMessage(result);
      if (warn) toast.warning(warn);
      else if (result?.ok) toast.success("WhatsApp-Nachricht gesendet.");
      else toast.error("Senden fehlgeschlagen.");
      void loadThread();
      void loadConversations();
      return;
    }

    if (platform === "email") {
      const result = isEmailPseudoContactId(contactParam)
        ? await triggerEmailInboxSend({
            restaurantId,
            emailContactId: contactParam,
            messageBody: body,
            restaurantName,
          })
        : await triggerEmailInboxSend({
            restaurantId,
            contactId: contactParam,
            messageBody: body,
            restaurantName,
            storeUnderContact: true,
          });
      setSending(false);
      const warn = sendContactMessageUserMessage(result);
      if (warn) toast.warning(warn);
      else if (result?.ok) toast.success("E-Mail gesendet.");
      else toast.error("Senden fehlgeschlagen.");
      void loadThread();
      void loadConversations();
      return;
    }

    const channels: ("gwada" | "whatsapp" | "email")[] = ["gwada"];
    if (sendWhatsapp) channels.push("whatsapp");
    if (sendEmail) channels.push("email");

    const result = await triggerSendContactMessage({
      restaurantId,
      contactId: contactParam,
      messageBody: body,
      direction: "outbound",
      channels,
      restaurantName,
    });
    setSending(false);

    const warn = sendContactMessageUserMessage(result);
    if (warn) toast.warning(warn);
    else if (result?.ok) toast.success("Nachricht gesendet.");
    else toast.error("Senden fehlgeschlagen.");

    void loadThread();
  };

  if (!supabaseEnvOk) {
    return (
      <p className="text-sm text-muted-foreground">
        Supabase-Umgebungsvariablen fehlen.
      </p>
    );
  }

  if (!workspaceReady) {
    return <WorkspaceRestaurantResolvePlaceholder />;
  }

  if (!restaurantId) {
    return <WorkspaceRestaurantMissingMessage />;
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-4 pt-2">
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {CONTACT_MESSAGE_PLATFORM_ORDER.map((p) => (
          <ContactMessagePlatformChip
            key={p}
            platform={p}
            selected={platform === p}
            onSelect={() => selectPlatform(p)}
            disabled={connectionsLoading || !isPlatformAvailable(p)}
          />
        ))}
      </div>

      {inboxHint && !contactParam ? (
        <p className="text-sm text-muted-foreground">{inboxHint}</p>
      ) : null}

      {!connectionsLoading &&
      platform === "whatsapp" &&
      !whatsappConnected ? (
        <p className="text-sm text-muted-foreground">
          WhatsApp ist nicht verbunden. Unter Einstellungen → Integrationen
          verknüpfen, dann erscheinen die Chats hier.
        </p>
      ) : null}

      {!connectionsLoading && platform === "email" && !emailConnected ? (
        <p className="text-sm text-muted-foreground">
          Kein eigenes E-Mail-Konto verbunden. Unter Einstellungen →
          Integrationen einen SMTP/IMAP-Zugang als „Eigene Verbindung“
          einrichten.
        </p>
      ) : null}

      {!connectionsLoading &&
      platform === "facebook" &&
      facebookEnabled &&
      !facebookConnected ? (
        <p className="text-sm text-muted-foreground">
          Facebook ist nicht verbunden. Unter Einstellungen → Integrationen die
          Facebook-Seite verknüpfen.
        </p>
      ) : null}

      {platform !== "gwada" &&
      platform !== "whatsapp" &&
      platform !== "email" ? (
        <p className="text-sm text-muted-foreground">
          {CONTACT_MESSAGE_PLATFORM_LABELS[platform]} wird demnächst
          angebunden.
        </p>
      ) : null}

      {contactParam ? (
        <Card className="flex w-full min-w-0 flex-col border-border/50 shadow-card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-border/50 px-4 py-3 sm:px-6">
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0"
              aria-label="Zurück zur Liste"
              onClick={backToList}
            >
              <ArrowLeft className="size-4" />
            </Button>
            <div className="min-w-0 flex-1">
              {contactParam && canOpenLinkedContact(contactParam) ? (
                <button
                  type="button"
                  className="max-w-full truncate text-left text-base font-semibold tracking-tight hover:underline"
                  onClick={() => openLinkedContact(contactParam)}
                >
                  {contactName || "Kontakt"}
                </button>
              ) : (
                <p className="truncate font-semibold">{contactName || "Kontakt"}</p>
              )}
              {platform === "whatsapp" ? (
                whatsappHeaderSubtitle ? (
                  <p className="text-xs text-muted-foreground">
                    {whatsappHeaderSubtitle}
                  </p>
                ) : showWhatsAppMissingPhoneHint ? (
                  <p className="text-xs text-muted-foreground">
                    Nummer nicht verfügbar
                  </p>
                ) : null
              ) : (
                <p className="text-xs text-muted-foreground">
                  {CONTACT_MESSAGE_PLATFORM_LABELS[platform]}
                </p>
              )}
            </div>
            {contactParam &&
            (platform === "whatsapp" || platform === "email") &&
            isInboxPseudoContactId(contactParam) ? (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label={
                  platform === "email"
                    ? "Kontakt aus E-Mail-Chat anlegen"
                    : "Kontakt aus WhatsApp-Chat anlegen"
                }
                onClick={() =>
                  openCreateContactFromPseudo(
                    contactParam,
                    contactName ||
                      (platform === "email" ? "E-Mail" : "WhatsApp"),
                  )
                }
              >
                <Plus className="size-4" />
              </Button>
            ) : null}
            {contactParam &&
            canOpenLinkedContact(contactParam) &&
            (platform === "whatsapp" || platform === "email") ? (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label="Kontakt öffnen"
                onClick={() => openLinkedContact(contactParam)}
              >
                <UserRound className="size-4" />
              </Button>
            ) : null}
          </div>
          <CardContent className="flex h-[min(60dvh,560px)] max-h-[min(75dvh,680px)] flex-col gap-0 p-4 sm:p-6">
            <ContactMessageChatViewport
              messages={messages}
              loading={loadingThread}
              threadKey={`${platform}-${contactParam}`}
              onReservationOpen={(id) => void openReservationFromMessage(id)}
              wahaReactions={
                platform === "whatsapp" && restaurantId
                  ? {
                      restaurantId,
                      onReactionChange: () => {
                        void loadThread();
                        void loadConversations();
                      },
                    }
                  : undefined
              }
            />
            {canReply ? (
              <ContactMessageComposer
                disabled={loadingThread}
                sending={sending}
                hasPhone={platform === "whatsapp" ? true : hasPhone}
                hasEmail={
                  platform === "email" ? true : hasEmail
                }
                whatsappEnabled={whatsappEnabled && whatsappConnected}
                emailEnabled={emailEnabled && emailConnected}
                defaultSendWhatsapp={platform === "whatsapp"}
                defaultSendEmail={platform === "email"}
                variant={
                  platform === "whatsapp"
                    ? "whatsapp-only"
                    : platform === "email"
                      ? "email-only"
                      : "unified"
                }
                placeholder={
                  platform === "whatsapp"
                    ? "WhatsApp-Nachricht …"
                    : platform === "email"
                      ? "E-Mail schreiben …"
                      : undefined
                }
                onSend={handleSend}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : showConversationList ? (
        <Card className="w-full min-w-0 border-border/50 shadow-card">
          <div className="space-y-3 border-b border-border/50 px-4 py-3 sm:px-6">
            <div className="flex gap-2">
              <ContactConversationsSearchBar
                className="min-w-0 flex-1"
                value={chatSearch}
                onChange={setChatSearch}
                disabled={loadingList && !refreshingInbox}
                placeholder="Suchen …"
              />
              {showInboxRefresh ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="size-10 shrink-0 rounded-full"
                  disabled={refreshingInbox}
                  aria-label="Chats aktualisieren"
                  title="Chats aktualisieren"
                  onClick={() => void refreshInbox()}
                >
                  <RefreshCw
                    className={cn(
                      "size-4",
                      refreshingInbox && "animate-spin",
                    )}
                    aria-hidden
                  />
                </Button>
              ) : null}
            </div>
            <ContactConversationsReadFilter
              value={readFilter}
              onChange={setReadFilter}
              disabled={loadingList}
              unreadTotal={unreadInList}
            />
          </div>
          <CardContent className="p-0">
            {loadingList && !showListSkeleton ? (
              <div className="min-h-[14rem]" aria-busy />
            ) : loadingList && showListSkeleton ? (
              <ContactConversationsListSkeleton />
            ) : conversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
                {platform === "whatsapp" && whatsappConnected
                  ? "Keine WhatsApp-Chats gefunden."
                  : platform === "email" && emailConnected
                    ? "Keine E-Mail-Konversationen im Postfach."
                    : `Noch keine Chats auf ${CONTACT_MESSAGE_PLATFORM_LABELS[platform]}.`}
              </p>
            ) : filteredConversations.length === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">
                {readFilter === "unread"
                  ? "Keine ungelesenen Chats."
                  : readFilter === "read"
                    ? "Keine gelesenen Chats."
                    : chatSearch.trim()
                      ? `Keine Chats für „${chatSearch.trim()}“ gefunden.`
                      : "Keine Chats gefunden."}
              </p>
            ) : (
              <ul className="divide-y divide-border/50">
                {filteredConversations.map((c) => {
                  const listName = wahaConversationDisplayName(c);
                  const unread = c.is_unread;
                  return (
                  <li
                    key={c.contact_id}
                    className={cn(
                      "flex items-start gap-3 px-4 py-3 sm:px-6 sm:py-3.5",
                      unread && "bg-accent/[0.04]",
                    )}
                  >
                    <button
                      type="button"
                      className={cn(
                        "relative flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors",
                        unread
                          ? "bg-accent/25 text-accent"
                          : "bg-accent/15 text-accent hover:bg-accent/25",
                      )}
                      aria-label={`Chat mit ${listName} öffnen`}
                      onClick={() => openConversation(c.contact_id)}
                    >
                      {listName.slice(0, 1).toUpperCase()}
                      {unread ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-card"
                          aria-hidden
                        />
                      ) : null}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        {canOpenLinkedContact(c.contact_id) ? (
                          <button
                            type="button"
                            className={cn(
                              "min-w-0 truncate text-left hover:underline",
                              unread ? "font-semibold text-foreground" : "font-medium",
                            )}
                            onClick={() => openLinkedContact(c.contact_id)}
                          >
                            {listName}
                          </button>
                        ) : (
                          <span
                            className={cn(
                              "truncate",
                              unread ? "font-semibold text-foreground" : "font-medium",
                            )}
                          >
                            {listName}
                          </span>
                        )}
                        <div className="flex shrink-0 items-center gap-1.5">
                          {unread && c.unread_count > 0 ? (
                            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-accent-foreground">
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              unread
                                ? "font-medium text-accent"
                                : "text-muted-foreground",
                            )}
                          >
                            {formatWhen(c.last_at)}
                          </span>
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon-sm"
                                  className="size-7 shrink-0 rounded-full text-muted-foreground"
                                  aria-label="Chat-Aktionen"
                                  onClick={(e) => e.stopPropagation()}
                                />
                              }
                            >
                              <MoreVertical className="size-3.5" />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              {(platform === "whatsapp" ||
                                platform === "email") &&
                              isInboxPseudoContactId(c.contact_id) ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    openCreateContactFromPseudo(
                                      c.contact_id,
                                      listName,
                                    )
                                  }
                                >
                                  <UserPlus className="size-4" aria-hidden />
                                  Kontakt hinzufügen
                                </DropdownMenuItem>
                              ) : null}
                              {unread ? (
                                <DropdownMenuItem
                                  onClick={() =>
                                    void markConversationRead(c.contact_id)
                                  }
                                >
                                  <MailOpen className="size-4" aria-hidden />
                                  Als gelesen markieren
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem
                                  onClick={() =>
                                    void markConversationUnread(c.contact_id)
                                  }
                                >
                                  <Mail className="size-4" aria-hidden />
                                  Als ungelesen markieren
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="mt-0.5 w-full text-left transition-colors hover:opacity-90"
                        onClick={() => openConversation(c.contact_id)}
                      >
                        <p
                          className={cn(
                            "truncate text-sm",
                            unread
                              ? "font-medium text-foreground"
                              : "text-muted-foreground",
                            !unread &&
                              c.last_direction === "inbound" &&
                              "font-medium text-foreground/80",
                          )}
                        >
                          {c.last_is_reaction ? (
                            <span className="inline-flex max-w-full items-center gap-1 truncate">
                              {c.last_direction === "outbound" ? (
                                <span className="shrink-0">Sie: </span>
                              ) : null}
                              <span
                                className="shrink-0 text-[1.05rem] leading-none"
                                aria-hidden
                              >
                                {c.last_body}
                              </span>
                            </span>
                          ) : (
                            <>
                              {c.last_direction === "outbound" ? "Sie: " : ""}
                              {previewSnippet(c.last_body)}
                            </>
                          )}
                        </p>
                        {c.has_reservation_link ? (
                          <Badge
                            variant="outline"
                            className="mt-1.5 h-5 gap-0.5 px-1.5 text-[10px] font-normal"
                          >
                            <CalendarDays className="size-3" aria-hidden />
                            Reservierung
                          </Badge>
                        ) : null}
                      </button>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      ) : null}

      <ReservationEditDrawer
        open={reservationDrawerOpen}
        onOpenChange={(open) => {
          setReservationDrawerOpen(open);
          if (!open) setReservationForDrawer(null);
        }}
        reservation={reservationForDrawer}
        createFor={null}
        onSaved={() => {
          setReservationDrawerOpen(false);
          setReservationForDrawer(null);
          if (contactParam) void loadThread();
        }}
      />

      <ContactEditDrawer
        open={contactDrawerOpen}
        onOpenChange={(open) => {
          setContactDrawerOpen(open);
          if (!open) {
            setContactCreateDraft(null);
            setPendingInboxLink(null);
          }
        }}
        contactId={editContactId}
        restaurantId={restaurantId}
        defaultCountryIso2={defaultCountryIso2}
        initialDraft={contactCreateDraft}
        onSaved={(detail) => {
          void (async () => {
            if (
              detail?.created &&
              pendingInboxLink &&
              restaurantId &&
              detail.contactId
            ) {
              if (pendingInboxLink.platform === "whatsapp") {
                const link = await triggerLinkWahaThreadToContact({
                  restaurantId,
                  wahaContactId: pendingInboxLink.pseudoContactId,
                  contactId: detail.contactId,
                });
                if (link?.ok) {
                  const n = link.imported ?? 0;
                  toast.success(
                    n > 0
                      ? `${n} WhatsApp-Nachrichten mit dem Kontakt verknüpft.`
                      : "Kontakt angelegt.",
                  );
                } else {
                  toast.warning(
                    "Kontakt angelegt, WhatsApp-Verlauf konnte nicht importiert werden.",
                  );
                }
                setPendingInboxLink(null);
                setContactCreateDraft(null);
                router.replace(
                  `/kontakte/nachrichten?platform=gwada&contact=${detail.contactId}`,
                );
                return;
              }

              toast.success("Kontakt angelegt.");
              setPendingInboxLink(null);
              setContactCreateDraft(null);
              router.replace(
                `/kontakte/nachrichten?platform=email&contact=${detail.contactId}`,
              );
              return;
            }
            if (contactParam) void loadThread();
            else void loadConversations();
          })();
        }}
      />
    </div>
  );
}
