"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
import {
  contactInboxConversationRowClassName,
  contactInboxConversationRowOpenButtonClassName,
} from "@/components/contacts/contact-inbox-conversation-row-classes";
import { ContactConversationsReadFilter } from "@/components/contacts/contact-conversations-read-filter";
import { ContactConversationsSearchBar } from "@/components/contacts/contact-conversations-search-bar";
import { toast } from "sonner";
import { ContactEditDrawer } from "@/components/contacts/contact-edit-drawer";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import { ContactConversationAttachmentIcon } from "@/components/contacts/contact-conversation-attachment-icon";
import { ContactMessageComposer } from "@/components/contacts/contact-message-composer";
import { ContactInboxFilterChips } from "@/components/contacts/contact-inbox-filter-chips";
import { ContactMessagePlatformIcon } from "@/components/contacts/contact-message-platform-chip";
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
  INBOX_FILTER_ALL,
  parseInboxPlatformFilter,
  type ContactMessagePlatform,
  type InboxPlatformFilter,
} from "@/lib/constants/contact-message-platforms";
import { enrichMessagesWithWahaReactionIds } from "@/lib/contact-messages/enrich-message-waha-ids";
import {
  lastInboundPlatform,
  inboxReplySendDefaults,
} from "@/lib/contact-messages/last-inbound-channel";
import { contactReplyChannels } from "@/lib/contact-messages/reply-channel-availability";
import {
  GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
  patchUnifiedInboxCacheConversation,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import {
  getUnifiedInboxRefreshInflight,
  refreshUnifiedInboxCache,
  UNIFIED_INBOX_BACKGROUND_POLL_MS,
} from "@/lib/contact-messages/unified-inbox-background-sync";
import { filterInboxConversationsByPlatform } from "@/lib/contact-messages/unified-inbox-merge";
import {
  fetchUnifiedInboxConversations,
  isUnifiedInboxFilter,
  markUnifiedInboxConversationReadClient,
} from "@/lib/contact-messages/unified-inbox-client";
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
  peekContactThreadCache,
  setContactThreadCache,
} from "@/lib/contact-messages/contact-thread-cache";
import { mergeLinkedContactThreadMessages } from "@/lib/contact-messages/merge-linked-contact-thread-messages";
import {
  applyConversationReadFilterToSearchParams,
  filterConversationsByRead,
  filterContactConversations,
  parseConversationReadFilter,
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
  wahaThreadTitleFromPreview,
} from "@/lib/contact-messages/waha-chat-label";
import {
  digitsFromWhatsAppChatId,
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
import { guestPhoneToWhatsAppChatId } from "@/lib/whatsapp/phone-to-chat-id";
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

function previewSnippet(
  body: string,
  attachmentKind?: ContactConversationPreview["last_attachment_kind"],
  max = 72,
): string {
  const t = body.replace(/\s+/g, " ").trim();
  if (t) {
    if (t.length <= max) return t;
    return `${t.slice(0, max - 1)}…`;
  }
  if (attachmentKind === "image") return "Bild";
  if (attachmentKind === "file") return "Datei";
  return "—";
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

function contactInboxMarkReadErrorMessage(error: string): string {
  switch (error) {
    case "no_contact_email":
      return "Für diesen Chat ist keine E-Mail-Adresse hinterlegt.";
    case "imap_not_configured":
      return "E-Mail-Konto ist nicht verbunden.";
    default:
      return `Als gelesen markieren: ${error}`;
  }
}

function contactInboxMarkUnreadErrorMessage(error: string): string {
  switch (error) {
    case "no_contact_email":
      return "Für diesen Chat ist keine E-Mail-Adresse hinterlegt.";
    case "imap_not_configured":
      return "E-Mail-Konto ist nicht verbunden.";
    default:
      return `Als ungelesen markieren: ${error}`;
  }
}

export function ContactsMessagesScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const contactParam = searchParams.get("contact");
  const platformParam = searchParams.get("platform");
  const readParam = searchParams.get("read");

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
    instagramEnabled,
    instagramConnected,
    staffInviteEmailAvailable,
  } = useRestaurantChannelConnections(restaurantId);

  const [inboxFilter, setInboxFilter] = useState<InboxPlatformFilter>(() =>
    parseInboxPlatformFilter(platformParam, contactParam),
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
  const [whatsappThreadPhone, setWhatsappThreadPhone] = useState<string | null>(
    null,
  );
  const [whatsappThreadChatId, setWhatsappThreadChatId] = useState<
    string | null
  >(null);
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
  const [readFilter, setReadFilter] = useState<ConversationReadFilter>(() =>
    parseConversationReadFilter(readParam),
  );
  const [refreshingInbox, setRefreshingInbox] = useState(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    setChatSearch("");
    setReadFilter("all");
  }, [inboxFilter]);

  const filteredConversations = useMemo(() => {
    const byPlatform = filterInboxConversationsByPlatform(
      conversations,
      inboxFilter,
    );
    const searched = filterContactConversations(byPlatform, chatSearch);
    return filterConversationsByRead(searched, readFilter);
  }, [conversations, chatSearch, readFilter, inboxFilter]);

  const linkedThread =
    Boolean(contactParam) && isLinkedContactId(contactParam!);

  const displayMessages = useMemo(() => {
    const rows = enrichMessagesWithWahaReactionIds(messages);
    if (!contactParam) return rows;
    return rows.filter((m) => m.contact_id === contactParam);
  }, [messages, contactParam]);

  const linkedReplyChannels = useMemo(() => {
    if (!linkedThread || !contactParam) {
      return {
        canWhatsapp: false,
        canEmail: false,
        emailViaPlatformFallback: false,
      };
    }
    return contactReplyChannels({
      whatsappEnabled,
      whatsappConnected,
      emailEnabled,
      emailConnected,
      staffInviteEmailAvailable,
      hasPhone: isWahaPseudoContactId(contactParam) ? true : hasPhone,
      hasEmail: isEmailPseudoContactId(contactParam) ? true : hasEmail,
    });
  }, [
    linkedThread,
    contactParam,
    whatsappEnabled,
    whatsappConnected,
    emailEnabled,
    emailConnected,
    staffInviteEmailAvailable,
    hasPhone,
    hasEmail,
  ]);

  const defaultReplySend = useMemo(
    () =>
      inboxReplySendDefaults(displayMessages, {
        canWhatsapp: linkedReplyChannels.canWhatsapp,
        canEmail: linkedReplyChannels.canEmail,
      }),
    [displayMessages, linkedReplyChannels],
  );

  const lastGuestPlatform = useMemo(
    () => lastInboundPlatform(displayMessages),
    [displayMessages],
  );

  const whatsappHeaderSubtitle = useMemo(() => {
    if (!contactParam || linkedThread) return null;
    if (inboxFilter !== "whatsapp" && !isWahaPseudoContactId(contactParam)) {
      return null;
    }
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
    inboxFilter,
    contactParam,
    linkedThread,
    whatsappThreadPhone,
    contactName,
    defaultCountryIso2,
  ]);

  const showWhatsAppMissingPhoneHint = useMemo(() => {
    if (
      linkedThread ||
      inboxFilter !== "whatsapp" ||
      loadingThread ||
      whatsappHeaderSubtitle
    ) {
      return false;
    }
    const name = contactName.trim();
    if (!name) return true;
    return (
      needsWahaDisplayNameResolve(name) || isWhatsAppJidOrRawNumberLabel(name)
    );
  }, [inboxFilter, linkedThread, loadingThread, whatsappHeaderSubtitle, contactName]);

  const unreadInList = useMemo(
    () => conversations.reduce((n, c) => n + (c.is_unread ? c.unread_count : 0), 0),
    [conversations],
  );

  const showListSkeleton = useDeferredSkeleton(
    loadingList && !refreshingInbox && conversations.length === 0,
  );

  const showConversationList =
    !contactParam &&
    (isUnifiedInboxFilter(inboxFilter) ||
      (inboxFilter === "whatsapp" && whatsappConnected) ||
      (inboxFilter === "email" && emailConnected) ||
      inboxFilter === "facebook" ||
      inboxFilter === "instagram");

  const isInboxFilterAvailable = useCallback(
    (p: InboxPlatformFilter): boolean => {
      if (p === INBOX_FILTER_ALL) return true;
      if (p === "gwada") return false;
      if (p === "whatsapp") return whatsappEnabled && whatsappConnected;
      if (p === "email") return emailEnabled && emailConnected;
      if (p === "facebook") return facebookEnabled && facebookConnected;
      if (p === "instagram") return instagramEnabled && instagramConnected;
      return false;
    },
    [
      whatsappEnabled,
      whatsappConnected,
      emailEnabled,
      emailConnected,
      facebookEnabled,
      facebookConnected,
      instagramEnabled,
      instagramConnected,
    ],
  );

  useEffect(() => {
    if (connectionsLoading || !workspaceReady || !restaurantId) return;

    const resolved = parseInboxPlatformFilter(platformParam, contactParam);
    let next = resolved;
    if (!isInboxFilterAvailable(resolved)) {
      next = INBOX_FILTER_ALL;
    }

    setInboxFilter((prev) => (prev === next ? prev : next));

    const needsFilterInUrl =
      platformParam !== next ||
      (platformInferredFromContact(contactParam) && !platformParam) ||
      (contactParam && !searchParams.get("contact"));

    if (needsFilterInUrl) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("platform", next);
      if (contactParam) params.set("contact", contactParam);
      router.replace(`/dashboard/kontakte/nachrichten?${params.toString()}`);
    }
  }, [
    connectionsLoading,
    workspaceReady,
    restaurantId,
    platformParam,
    contactParam,
    isInboxFilterAvailable,
    router,
    searchParams,
  ]);

  useEffect(() => {
    const next = parseConversationReadFilter(readParam);
    setReadFilter((prev) => (prev === next ? prev : next));
  }, [readParam]);

  const selectReadFilter = useCallback(
    (filter: ConversationReadFilter) => {
      setReadFilter(filter);
      const params = new URLSearchParams(searchParams.toString());
      applyConversationReadFilterToSearchParams(params, filter);
      router.replace(`/dashboard/kontakte/nachrichten?${params.toString()}`);
    },
    [router, searchParams],
  );

  const loadConversations = useCallback(async (opts?: { silent?: boolean; force?: boolean }) => {
    if (!restaurantId) {
      setConversations([]);
      setLoadingList(false);
      return;
    }

    if (isUnifiedInboxFilter(inboxFilter)) {
      if (!opts?.force) {
        const cached = peekUnifiedInboxCache(restaurantId);
        if (cached) {
          setConversations(cached);
          setLoadingList(false);
          return;
        }

        const inflight = getUnifiedInboxRefreshInflight();
        if (inflight) {
          if (!opts?.silent) setLoadingList(true);
          const data = await inflight;
          if (data) {
            setConversations(data);
            setLoadingList(false);
            return;
          }
        }
      }
    }

    if (!opts?.silent) setLoadingList(true);

    if (isUnifiedInboxFilter(inboxFilter)) {
      const { data, error } = await fetchUnifiedInboxConversations({
        restaurantId,
        whatsappConnected,
        emailConnected,
      });
      if (error) toast.error(error.message);
      setConversations(data);
    } else if (inboxFilter === "whatsapp" && whatsappConnected) {
      const { data, error } = await fetchWahaConversationsClient(restaurantId);
      if (error) {
        toast.error(
          error === "waha_not_configured"
            ? "WAHA ist nicht konfiguriert."
            : `WhatsApp-Chats konnten nicht geladen werden: ${error}`,
        );
        setConversations([]);
      } else {
        setConversations(data);
      }
    } else if (inboxFilter === "email" && emailConnected) {
      const { data, error } = await fetchEmailConversationsClient(restaurantId);
      if (error) {
        toast.error(
          error === "imap_not_configured"
            ? "E-Mail-Konto nicht verbunden."
            : `E-Mail-Postfach konnte nicht geladen werden: ${error}`,
        );
        setConversations([]);
      } else {
        const enriched = await enrichConversationsWithReadState({
          restaurantId,
          platform: "email",
          conversations: data,
        });
        setConversations(enriched);
      }
    } else if (inboxFilter === "facebook" || inboxFilter === "instagram") {
      const platform = inboxFilter;
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
    }

    setLoadingList(false);
  }, [restaurantId, inboxFilter, whatsappConnected, emailConnected]);

  const refreshInbox = useCallback(async () => {
    if (!restaurantId) return;
    setRefreshingInbox(true);
    try {
      if (isUnifiedInboxFilter(inboxFilter)) {
        await refreshUnifiedInboxCache(
          { restaurantId, whatsappConnected, emailConnected },
          { force: true },
        );
        const cached = peekUnifiedInboxCache(restaurantId);
        if (cached) setConversations(cached);
      } else {
        await loadConversations({ silent: true, force: true });
      }
    } finally {
      setRefreshingInbox(false);
    }
  }, [
    restaurantId,
    inboxFilter,
    whatsappConnected,
    emailConnected,
    loadConversations,
  ]);

  const showInboxRefresh =
    !contactParam &&
    (isUnifiedInboxFilter(inboxFilter) ||
      (inboxFilter === "whatsapp" && whatsappConnected) ||
      (inboxFilter === "email" && emailConnected));

  const patchConversationReadState = useCallback(
    (contactId: string, isUnread: boolean, unreadCount = 0) => {
      setConversations((prev) =>
        prev.map((c) =>
          c.contact_id === contactId
            ? { ...c, is_unread: isUnread, unread_count: unreadCount }
            : c,
        ),
      );
      if (restaurantId) {
        patchUnifiedInboxCacheConversation(restaurantId, contactId, {
          is_unread: isUnread,
          unread_count: unreadCount,
        });
      }
    },
    [restaurantId],
  );

  const markConversationRead = useCallback(
    async (conversationKey: string) => {
      if (!restaurantId) return;
      const result = isLinkedContactId(conversationKey)
        ? await markUnifiedInboxConversationReadClient({
            restaurantId,
            contactId: conversationKey,
            whatsappConnected,
            emailConnected,
          })
        : await markConversationReadClient({
            restaurantId,
            conversationKey,
            platform: isWahaPseudoContactId(conversationKey)
              ? "whatsapp"
              : isEmailPseudoContactId(conversationKey)
                ? "email"
                : "gwada",
          });
      if (!result.ok && result.error) {
        toast.error(contactInboxMarkReadErrorMessage(result.error));
        return;
      }
      patchConversationReadState(conversationKey, false, 0);
      if (
        isEmailPseudoContactId(conversationKey) ||
        inboxFilter === "email" ||
        inboxFilter === "whatsapp" ||
        isUnifiedInboxFilter(inboxFilter)
      ) {
        void loadConversations({ silent: true, force: true });
      }
    },
    [
      restaurantId,
      inboxFilter,
      whatsappConnected,
      emailConnected,
      patchConversationReadState,
      loadConversations,
    ],
  );

  const markConversationUnread = useCallback(
    async (conversationKey: string) => {
      if (!restaurantId) return;
      const readPlatform = isWahaPseudoContactId(conversationKey)
        ? "whatsapp"
        : isEmailPseudoContactId(conversationKey)
          ? "email"
          : "gwada";
      const { ok, error } = await markConversationUnreadClient({
        restaurantId,
        conversationKey,
        platform: readPlatform,
      });
      if (!ok && error) {
        toast.error(contactInboxMarkUnreadErrorMessage(error));
        return;
      }
      patchConversationReadState(conversationKey, true, 1);
    },
    [restaurantId, patchConversationReadState],
  );

  const loadThread = useCallback(async (opts?: { silent?: boolean }) => {
    if (!restaurantId || !contactParam) {
      setMessages([]);
      setWhatsappThreadPhone(null);
      setLoadingThread(false);
      return;
    }
    if (!isWahaPseudoContactId(contactParam)) {
      setWhatsappThreadPhone(null);
    }
    if (!linkedThread) {
      setWhatsappThreadChatId(null);
    }
    let threadLoaded = false;

    const effectivePlatform =
      platformInferredFromContact(contactParam) ??
      (inboxFilter === INBOX_FILTER_ALL ? "gwada" : inboxFilter);

    const persistThreadCache = (params: {
      threadMessages: ContactMessageRow[];
      name: string;
      phone: boolean;
      email: boolean;
      chatId: string | null;
    }) => {
      setContactThreadCache(restaurantId, contactParam, {
        messages: params.threadMessages,
        contactName: params.name,
        hasPhone: params.phone,
        hasEmail: params.email,
        whatsappThreadChatId: params.chatId,
      });
    };

    if (linkedThread) {
      const syncInbox = () =>
        fetch("/api/contact-messages/inbox-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            restaurantId,
            contactId: contactParam,
          }),
        }).catch(() => undefined);
      if (opts?.silent) void syncInbox();
      else await syncInbox();

      const [
        { data: msgs, error: msgErr },
        { data: contact },
        emailThread,
      ] = await Promise.all([
        fetchContactMessages({
          restaurantId,
          contactId: contactParam,
        }),
        fetchContactById({ restaurantId, contactId: contactParam }),
        emailConnected
          ? fetchEmailMessagesClient({
              restaurantId,
              contactId: contactParam,
            })
          : Promise.resolve({ data: [], error: null as string | null }),
      ]);
      if (msgErr) toast.error(msgErr.message);
      else threadLoaded = true;
      const mergedMessages = mergeLinkedContactThreadMessages({
        dbMessages: msgs,
        imapEmailMessages:
          emailThread.error || emailThread.data.length === 0
            ? null
            : emailThread.data,
      });
      setMessages(mergedMessages);
      const resolvedName = contact
        ? contactThreadDisplayName(contact)
        : contactName;
      const resolvedPhone = contact
        ? Boolean(primaryPhone(contact)?.trim())
        : hasPhone;
      const resolvedEmail = contact
        ? Boolean(primaryEmail(contact)?.trim())
        : hasEmail;
      const resolvedChatId = contact
        ? guestPhoneToWhatsAppChatId(primaryPhone(contact)?.trim() ?? null)
        : whatsappThreadChatId;
      if (contact) {
        setContactName(resolvedName);
        setHasPhone(resolvedPhone);
        setHasEmail(resolvedEmail);
        setWhatsappThreadChatId(resolvedChatId);
      }
      persistThreadCache({
        threadMessages: mergedMessages,
        name: resolvedName,
        phone: resolvedPhone,
        email: resolvedEmail,
        chatId: resolvedChatId,
      });
      setLoadingThread(false);
      if (threadLoaded) {
        void markConversationRead(contactParam);
      }
      return;
    }

    const convPreview = conversationsRef.current.find(
      (c) => c.contact_id === contactParam,
    );
    const listTitle = wahaThreadTitleFromPreview(convPreview);
    if (listTitle) {
      setContactName(listTitle);
    }

    if (effectivePlatform === "email" && emailConnected) {
      let threadMessages: ContactMessageRow[] = [];
      const { data, error } = await fetchEmailMessagesClient({
        restaurantId,
        contactId: contactParam,
      });
      if (error) {
        toast.error(
          error === "no_contact_email"
            ? "E-Mail-Verlauf: keine Adresse für diesen Kontakt."
            : error === "imap_not_configured"
              ? "E-Mail-Konto ist nicht verbunden."
              : `E-Mail-Verlauf: ${error}`,
        );
        setMessages([]);
      } else {
        threadMessages = data;
        setMessages(data);
        threadLoaded = true;
      }
      let resolvedName = listTitle ?? contactName;
      let resolvedPhone = hasPhone;
      let resolvedEmail = hasEmail;
      if (
        !isEmailPseudoContactId(contactParam) &&
        !isWahaPseudoContactId(contactParam)
      ) {
        const { data: contact } = await fetchContactById({
          restaurantId,
          contactId: contactParam,
        });
        if (contact) {
          resolvedName = contactThreadDisplayName(contact);
          resolvedPhone = Boolean(primaryPhone(contact)?.trim());
          resolvedEmail = Boolean(primaryEmail(contact)?.trim());
          setContactName(resolvedName);
          setHasPhone(resolvedPhone);
          setHasEmail(resolvedEmail);
        }
      } else {
        const conv = conversationsRef.current.find(
          (c) => c.contact_id === contactParam,
        );
        resolvedName = conv?.contact_name ?? "E-Mail";
        resolvedPhone = false;
        resolvedEmail = true;
        setContactName(resolvedName);
        setHasPhone(resolvedPhone);
        setHasEmail(resolvedEmail);
      }
      if (threadLoaded) {
        persistThreadCache({
          threadMessages,
          name: resolvedName,
          phone: resolvedPhone,
          email: resolvedEmail,
          chatId: whatsappThreadChatId,
        });
      }
    } else if (effectivePlatform === "whatsapp" && whatsappConnected) {
      let threadMessages: ContactMessageRow[] = [];
      const { data, error } = await fetchWahaMessagesClient({
        restaurantId,
        contactId: contactParam,
      });
      if (error) {
        toast.error(`WhatsApp-Verlauf: ${error}`);
        setMessages([]);
      } else {
        threadMessages = data;
        setMessages(data);
        threadLoaded = true;
      }

      let resolvedName = listTitle ?? contactName;
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
        } else if (listTitle) {
          resolvedName = listTitle;
          setContactName(listTitle);
          setHasPhone(true);
          setHasEmail(false);
        }
      } else {
        const chatId = wahaChatIdFromPseudoContactId(contactParam);
        let name =
          listTitle ??
          wahaConversationDisplayName({
            contact_id: contactParam,
            contact_name: convPreview?.contact_name ?? "WhatsApp",
          });

        if (chatId && needsWahaDisplayNameResolve(name)) {
          const digits = digitsFromWhatsAppChatId(chatId);
          if (digits) {
            const normalized =
              normalizeContactPhone(digits) ?? normalizeContactPhone(`+${digits}`);
            if (normalized) {
              const existing = await findContactByPhoneNormalized({
                restaurantId,
                phoneNormalized: normalized,
              });
              if (existing) {
                const { data: contact } = await fetchContactById({
                  restaurantId,
                  contactId: existing.contactId,
                });
                if (contact) {
                  contactRow = contact;
                  name = contactThreadDisplayName(contact);
                } else {
                  name = existing.displayName;
                }
              }
            }
          }
        }

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

      const pseudoChatId = wahaChatIdFromPseudoContactId(contactParam);
      const linkedChatId = contactRow
        ? guestPhoneToWhatsAppChatId(primaryPhone(contactRow)?.trim() ?? null)
        : null;
      const resolvedChatId = pseudoChatId ?? linkedChatId;
      setWhatsappThreadChatId(resolvedChatId);
      if (threadLoaded) {
        persistThreadCache({
          threadMessages,
          name: resolvedName,
          phone: true,
          email: contactRow ? Boolean(primaryEmail(contactRow)?.trim()) : false,
          chatId: resolvedChatId,
        });
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
    linkedThread,
    inboxFilter,
    whatsappConnected,
    emailConnected,
    markConversationRead,
    defaultCountryIso2,
  ]);

  useEffect(() => {
    if (!restaurantId || contactParam) return;
    if (!isUnifiedInboxFilter(inboxFilter)) return;

    const onCacheUpdated = (event: Event) => {
      const detail = (event as CustomEvent<{ restaurantId?: string }>).detail;
      if (detail?.restaurantId !== restaurantId) return;
      const cached = peekUnifiedInboxCache(restaurantId);
      if (cached) setConversations(cached);
    };

    window.addEventListener(
      GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
      onCacheUpdated,
    );
    return () => {
      window.removeEventListener(
        GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
        onCacheUpdated,
      );
    };
  }, [restaurantId, contactParam, inboxFilter]);

  useEffect(() => {
    if (!restaurantId || !contactParam) return;

    const onLive = () => {
      void loadThread({ silent: true });
    };

    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onLive);
    return () => {
      window.removeEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onLive);
    };
  }, [restaurantId, contactParam, loadThread]);

  useLayoutEffect(() => {
    if (connectionsLoading || !restaurantId || !contactParam) return;

    const cached = peekContactThreadCache(restaurantId, contactParam);
    if (cached) {
      setMessages(cached.messages);
      setContactName(cached.contactName);
      setHasPhone(cached.hasPhone);
      setHasEmail(cached.hasEmail);
      setWhatsappThreadChatId(cached.whatsappThreadChatId);
      setLoadingThread(false);
    }
  }, [contactParam, connectionsLoading, restaurantId]);

  useEffect(() => {
    if (connectionsLoading || !restaurantId) return;

    if (!contactParam) {
      const hasList =
        conversationsRef.current.length > 0 ||
        Boolean(peekUnifiedInboxCache(restaurantId)?.length);
      void loadConversations(hasList ? { silent: true } : undefined);
      return;
    }

    const cached = peekContactThreadCache(restaurantId, contactParam);
    void loadThread({ silent: Boolean(cached) });
  }, [
    contactParam,
    connectionsLoading,
    restaurantId,
    loadThread,
    loadConversations,
  ]);

  useEffect(() => {
    if (!restaurantId || !contactParam || !linkedThread) return;

    const pollInbox = () => {
      void fetch("/api/contact-messages/inbox-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId,
          contactId: contactParam,
        }),
      })
        .then((res) => res.json())
        .then((data: { imported?: number }) => {
          if ((data.imported ?? 0) > 0) void loadThread();
        })
        .catch(() => undefined);
    };

    const intervalId = window.setInterval(pollInbox, UNIFIED_INBOX_BACKGROUND_POLL_MS);
    return () => window.clearInterval(intervalId);
  }, [restaurantId, contactParam, linkedThread, loadThread]);

  const selectInboxFilter = (filter: InboxPlatformFilter) => {
    if (!isInboxFilterAvailable(filter)) return;
    setInboxFilter(filter);
    const params = new URLSearchParams(searchParams.toString());
    params.set("platform", filter);
    params.delete("contact");
    applyConversationReadFilterToSearchParams(params, readFilter);
    router.replace(`/dashboard/kontakte/nachrichten?${params.toString()}`);
  };

  const canOpenLinkedContact = useCallback(
    (contactId: string) => isLinkedContactId(contactId),
    [],
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
          `/dashboard/kontakte/nachrichten?platform=all&contact=${existingContactId}`,
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
                `/dashboard/kontakte/nachrichten?platform=all&contact=${existing.contactId}`,
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
    const cached =
      restaurantId && peekContactThreadCache(restaurantId, contactId);
    if (cached) {
      setMessages(cached.messages);
      setContactName(cached.contactName);
      setHasPhone(cached.hasPhone);
      setHasEmail(cached.hasEmail);
      setWhatsappThreadChatId(cached.whatsappThreadChatId);
      setLoadingThread(false);
    } else {
      const preview = conversationsRef.current.find(
        (c) => c.contact_id === contactId,
      );
      const previewTitle = wahaThreadTitleFromPreview(preview);
      if (previewTitle) setContactName(previewTitle);
      setMessages([]);
      setLoadingThread(true);
    }

    const params = new URLSearchParams(searchParams.toString());
    params.set("platform", inboxFilter);
    params.set("contact", contactId);
    router.push(`/dashboard/kontakte/nachrichten?${params.toString()}`);
  };

  const backToList = () => {
    const params = new URLSearchParams();
    params.set("platform", inboxFilter);
    applyConversationReadFilterToSearchParams(params, readFilter);
    router.push(`/dashboard/kontakte/nachrichten?${params.toString()}`);
  };

  const restaurantName = profile.name.trim() || undefined;
  const canSendViaExternal =
    Boolean(contactParam) &&
    linkedThread &&
    (linkedReplyChannels.canWhatsapp || linkedReplyChannels.canEmail);

  const canReply =
    contactParam != null &&
    (linkedThread
      ? canSendViaExternal
      : isWahaPseudoContactId(contactParam)
        ? whatsappConnected
        : isEmailPseudoContactId(contactParam)
          ? emailConnected
          : false);

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
    if (!restaurantId || !contactParam || !canReply) return;

    setSending(true);

    if (linkedThread) {
      if (!sendWhatsapp && !sendEmail) {
        setSending(false);
        toast.error(
          "Mindestens WhatsApp oder E-Mail auswählen — Antworten nur über externe Kanäle.",
        );
        return;
      }
      const channels: ("whatsapp" | "email")[] = [];
      if (sendWhatsapp) channels.push("whatsapp");
      if (sendEmail) channels.push("email");
      const result = await triggerSendContactMessage({
        restaurantId,
        contactId: contactParam,
        messageBody: body,
        direction: "outbound",
        channels,
        restaurantName,
        files,
      });
      setSending(false);
      const warn = sendContactMessageUserMessage(result);
      if (warn) toast.warning(warn);
      else if (result?.ok) toast.success("Nachricht gesendet.");
      else toast.error("Senden fehlgeschlagen.");
      void loadThread();
      void loadConversations({ silent: true });
      return;
    }

    if (isWahaPseudoContactId(contactParam)) {
      const result = isWahaPseudoContactId(contactParam)
        ? await triggerWahaSendMessage({
            restaurantId,
            wahaContactId: contactParam,
            messageBody: body,
            files,
          })
        : await triggerWahaSendMessage({
            restaurantId,
            contactId: contactParam,
            messageBody: body,
            storeUnderContact: true,
            files,
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

    if (isEmailPseudoContactId(contactParam)) {
      const result = isEmailPseudoContactId(contactParam)
        ? await triggerEmailInboxSend({
            restaurantId,
            emailContactId: contactParam,
            messageBody: body,
            restaurantName,
            files,
          })
        : await triggerEmailInboxSend({
            restaurantId,
            contactId: contactParam,
            messageBody: body,
            restaurantName,
            storeUnderContact: true,
            files,
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

    setSending(false);
    toast.error("Senden für diesen Chat nicht möglich.");
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
      <ContactInboxFilterChips
        filter={inboxFilter}
        onFilterChange={selectInboxFilter}
        isPlatformAvailable={isInboxFilterAvailable}
        disabled={connectionsLoading}
      />

      {!connectionsLoading &&
      inboxFilter === "whatsapp" &&
      !whatsappConnected ? (
        <p className="text-sm text-muted-foreground">
          WhatsApp ist nicht verbunden. Unter Einstellungen → Integrationen
          verknüpfen, dann erscheinen die Chats hier.
        </p>
      ) : null}

      {!connectionsLoading && inboxFilter === "email" && !emailConnected ? (
        <p className="text-sm text-muted-foreground">
          Kein eigenes E-Mail-Konto verbunden. Unter Einstellungen →
          Integrationen einen SMTP/IMAP-Zugang als „Eigene Verbindung“
          einrichten.
        </p>
      ) : null}

      {!connectionsLoading &&
      inboxFilter === "facebook" &&
      facebookEnabled &&
      !facebookConnected ? (
        <p className="text-sm text-muted-foreground">
          Facebook ist nicht verbunden. Unter Einstellungen → Integrationen die
          Facebook-Seite verknüpfen.
        </p>
      ) : null}

      {!connectionsLoading &&
      inboxFilter === "instagram" &&
      instagramEnabled &&
      !instagramConnected ? (
        <p className="text-sm text-muted-foreground">
          Instagram ist nicht verbunden. Unter Einstellungen → Integrationen das
          Instagram-Business-Konto verknüpfen.
        </p>
      ) : null}

      {inboxFilter !== INBOX_FILTER_ALL &&
      inboxFilter !== "whatsapp" &&
      inboxFilter !== "email" ? (
        <p className="text-sm text-muted-foreground">
          {CONTACT_MESSAGE_PLATFORM_LABELS[inboxFilter]} wird demnächst
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
              {linkedThread && lastGuestPlatform ? (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span>Zuletzt aktiv über</span>
                  <ContactMessagePlatformIcon
                    platform={lastGuestPlatform}
                    variant="meta"
                  />
                  <span className="font-medium text-foreground">
                    {CONTACT_MESSAGE_PLATFORM_LABELS[lastGuestPlatform]}
                  </span>
                </p>
              ) : isWahaPseudoContactId(contactParam) ? (
                whatsappHeaderSubtitle ? (
                  <p className="text-xs text-muted-foreground">
                    {whatsappHeaderSubtitle}
                  </p>
                ) : showWhatsAppMissingPhoneHint ? (
                  <p className="text-xs text-muted-foreground">
                    Nummer nicht verfügbar
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground">WhatsApp</p>
                )
              ) : isEmailPseudoContactId(contactParam) ? (
                <p className="text-xs text-muted-foreground">E-Mail</p>
              ) : null}
            </div>
            {contactParam && isInboxPseudoContactId(contactParam) ? (
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="shrink-0 rounded-full"
                aria-label={
                  isEmailPseudoContactId(contactParam)
                    ? "Kontakt aus E-Mail-Chat anlegen"
                    : "Kontakt aus WhatsApp-Chat anlegen"
                }
                onClick={() =>
                  openCreateContactFromPseudo(
                    contactParam,
                    contactName ||
                      (isEmailPseudoContactId(contactParam)
                        ? "E-Mail"
                        : "WhatsApp"),
                  )
                }
              >
                <Plus className="size-4" />
              </Button>
            ) : null}
            {contactParam && canOpenLinkedContact(contactParam) ? (
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
          <CardContent className="flex h-[min(72dvh,680px)] max-h-[min(88dvh,820px)] flex-col gap-0 overflow-hidden p-0">
            <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 sm:px-6 sm:pt-5">
              <ContactMessageChatViewport
                messages={displayMessages}
                loading={loadingThread && displayMessages.length === 0}
                threadKey={`${inboxFilter}-${contactParam}`}
                className="min-h-0 flex-1"
                onReservationOpen={(id) => void openReservationFromMessage(id)}
                wahaReactions={
                  linkedThread &&
                  restaurantId &&
                  whatsappThreadChatId &&
                  displayMessages.some((m) => m.waha_message_id)
                    ? {
                        restaurantId,
                        onReactionChange: () => {
                          void loadThread();
                          void loadConversations();
                        },
                      }
                    : isWahaPseudoContactId(contactParam) && restaurantId
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
            </div>
            {canReply ? (
              <div className="sticky bottom-0 z-10 shrink-0 border-t border-border/50 bg-card px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.12)] sm:px-6">
                <ContactMessageComposer
                  disabled={loadingThread}
                  sending={sending}
                  hasPhone={
                    isWahaPseudoContactId(contactParam) ? true : hasPhone
                  }
                  hasEmail={
                    isEmailPseudoContactId(contactParam) ? true : hasEmail
                  }
                  whatsappEnabled={whatsappEnabled && whatsappConnected}
                  emailEnabled={
                    emailEnabled &&
                    (emailConnected || staffInviteEmailAvailable)
                  }
                  emailViaPlatformFallback={
                    linkedReplyChannels.emailViaPlatformFallback
                  }
                  defaultSendWhatsapp={defaultReplySend.whatsapp}
                  defaultSendEmail={defaultReplySend.email}
                  variant={
                    linkedThread
                      ? "inbox-reply"
                      : isWahaPseudoContactId(contactParam)
                        ? "whatsapp-only"
                        : isEmailPseudoContactId(contactParam)
                          ? "email-only"
                          : "unified"
                  }
                  stickyFooter
                  placeholder={
                    isWahaPseudoContactId(contactParam)
                      ? "WhatsApp-Nachricht …"
                      : isEmailPseudoContactId(contactParam)
                        ? "E-Mail schreiben …"
                        : "Antwort schreiben …"
                  }
                  whatsappTyping={
                    restaurantId &&
                    whatsappThreadChatId &&
                    (linkedThread
                      ? defaultReplySend.whatsapp
                      : isWahaPseudoContactId(contactParam))
                      ? {
                          restaurantId,
                          chatId: whatsappThreadChatId,
                        }
                      : null
                  }
                  onSend={handleSend}
                />
              </div>
            ) : linkedThread ? (
              <div className="sticky bottom-0 shrink-0 border-t border-border/50 bg-card px-4 py-4 sm:px-6">
                <p className="text-sm text-muted-foreground">
                  {!emailEnabled && !whatsappEnabled
                    ? "Nachrichten-Kanäle sind für dieses Restaurant nicht freigeschaltet."
                    : !staffInviteEmailAvailable &&
                        !emailConnected &&
                        !whatsappConnected
                      ? "Antworten erst möglich, wenn WhatsApp oder ein E-Mail-Postfach unter Einstellungen → Integrationen verbunden ist — oder die Plattform-E-Mail (Gwada-Fallback) aktiv ist."
                      : !hasEmail && !hasPhone
                        ? "Kontakt braucht eine Telefonnummer (WhatsApp) oder E-Mail-Adresse."
                        : !hasEmail
                          ? "Für E-Mail-Antworten (auch über Gwada-Fallback) eine E-Mail am Kontakt hinterlegen."
                          : !hasPhone && !whatsappConnected
                            ? "Für WhatsApp-Antworten eine Telefonnummer am Kontakt hinterlegen und WhatsApp verbinden."
                            : "Kein Versandweg verfügbar — Kanäle und Kontaktdaten prüfen."}
                </p>
              </div>
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
                  aria-label="Chats aktualisieren"
                  title={
                    refreshingInbox
                      ? "Posteingang wird aktualisiert …"
                      : "Chats aktualisieren"
                  }
                  onClick={() => void refreshInbox()}
                >
                  <RefreshCw
                    className={cn("size-4", refreshingInbox && "animate-spin")}
                    aria-hidden
                  />
                </Button>
              ) : null}
            </div>
            <ContactConversationsReadFilter
              value={readFilter}
              onChange={selectReadFilter}
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
                {inboxFilter === "whatsapp" && whatsappConnected
                  ? "Keine WhatsApp-Chats gefunden."
                  : inboxFilter === "email" && emailConnected
                    ? "Keine E-Mail-Konversationen im Postfach."
                    : inboxFilter === INBOX_FILTER_ALL
                      ? "Noch keine Konversationen im Posteingang."
                      : `Noch keine Chats auf ${CONTACT_MESSAGE_PLATFORM_LABELS[inboxFilter]}.`}
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
                      contactInboxConversationRowClassName,
                      unread && "bg-accent/[0.04]",
                    )}
                  >
                    <button
                      type="button"
                      className={contactInboxConversationRowOpenButtonClassName}
                      aria-label={`Chat mit ${listName} öffnen`}
                      onClick={() => openConversation(c.contact_id)}
                    />
                    <div
                      className={cn(
                        "relative z-10 flex size-11 shrink-0 items-center justify-center rounded-full text-sm font-semibold pointer-events-none",
                        unread
                          ? "bg-accent/25 text-accent"
                          : "bg-accent/15 text-accent",
                      )}
                      aria-hidden
                    >
                      {listName.slice(0, 1).toUpperCase()}
                      {unread ? (
                        <span
                          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-accent ring-2 ring-card"
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
                      <div className="flex items-baseline justify-between gap-2">
                        {canOpenLinkedContact(c.contact_id) ? (
                          <button
                            type="button"
                            className={cn(
                              "pointer-events-auto min-w-0 truncate text-left hover:underline",
                              unread ? "font-semibold text-foreground" : "font-medium",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              openLinkedContact(c.contact_id);
                            }}
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
                        <div className="pointer-events-auto flex shrink-0 items-center gap-1.5">
                          <ContactMessagePlatformIcon
                            platform={
                              c.last_message_platform ??
                              (isWahaPseudoContactId(c.contact_id)
                                ? "whatsapp"
                                : isEmailPseudoContactId(c.contact_id)
                                  ? "email"
                                  : "gwada")
                            }
                            variant="meta"
                          />
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
                              {isInboxPseudoContactId(c.contact_id) ? (
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
                      <div className="mt-0.5 w-full text-left">
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
                            <span className="inline-flex max-w-full items-center gap-1 truncate">
                              {c.last_attachment_kind ? (
                                <ContactConversationAttachmentIcon
                                  kind={c.last_attachment_kind}
                                />
                              ) : null}
                              {c.last_direction === "outbound" ? (
                                <span className="shrink-0">Sie: </span>
                              ) : null}
                              <span className="truncate">
                                {previewSnippet(
                                  c.last_body,
                                  c.last_attachment_kind,
                                )}
                              </span>
                            </span>
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
                      </div>
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
                  `/dashboard/kontakte/nachrichten?platform=all&contact=${detail.contactId}`,
                );
                return;
              }

              toast.success("Kontakt angelegt.");
              setPendingInboxLink(null);
              setContactCreateDraft(null);
              router.replace(
                `/dashboard/kontakte/nachrichten?platform=email&contact=${detail.contactId}`,
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
