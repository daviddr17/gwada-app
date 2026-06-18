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
  Link2,
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
import { InboxThreadAssignContactSheet } from "@/components/contacts/inbox-thread-assign-contact-sheet";
import {
  ContactInboxThreadOverlay,
  CONTACT_INBOX_THREAD_OVERLAY_MS,
} from "@/components/contacts/contact-inbox-thread-overlay";
import type {
  ContactMessageMetaReactionsConfig,
  ContactMessageWahaReactionsConfig,
} from "@/components/contacts/contact-message-bubble-list";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import { ReservationEditDrawer } from "@/components/reservations/reservation-edit-drawer";
import { ContactConversationAttachmentIcon } from "@/components/contacts/contact-conversation-attachment-icon";
import { ContactMessageComposer } from "@/components/contacts/contact-message-composer";
import { ContactInboxFilterChips } from "@/components/contacts/contact-inbox-filter-chips";
import { ContactMessagePlatformIcon } from "@/components/contacts/contact-message-platform-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
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
import { contactReplyChannels, inferContactReachabilityFromMessages } from "@/lib/contact-messages/reply-channel-availability";
import {
  GWADA_UNIFIED_INBOX_CACHE_UPDATED_EVENT,
  patchUnifiedInboxCacheConversation,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import {
  getUnifiedInboxRefreshInflight,
  refreshUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-background-sync";
import { filterInboxConversationsByPlatform } from "@/lib/contact-messages/unified-inbox-merge";
import {
  fetchUnifiedInboxConversations,
  isUnifiedInboxFilter,
  markUnifiedInboxConversationReadClient,
} from "@/lib/contact-messages/unified-inbox-client";
import {
  fetchWahaDisplayNameClient,
  fetchWahaResolvedPhoneClient,
  markConversationReadClient,
  markConversationUnreadClient,
} from "@/lib/contact-messages/fetch-inbox-client";
import { enrichConversationsWithReadState } from "@/lib/contact-messages/enrich-gwada-conversations-client";
import {
  CONTACT_THREAD_PAGE_SIZE,
  dedupeContactMessagesById,
} from "@/lib/contact-messages/contact-thread-pagination";
import {
  deleteContactThreadCacheEntry,
  peekContactThreadCache,
  setContactThreadCache,
} from "@/lib/contact-messages/contact-thread-cache";
import { fetchContactThreadPageClient } from "@/lib/contact-messages/fetch-contact-thread-client";
import {
  appendOptimisticMessage,
  createOptimisticOutboundMetaMessage,
  createOptimisticOutboundWhatsappMessage,
  dropOptimisticMatchingAnchors,
  isOptimisticContactMessage,
  mergeLoadedThreadWithOptimistic,
  patchWhatsappMessageByWahaId,
  removeOptimisticMessage,
  removeWhatsappMessageByWahaId,
} from "@/lib/contact-messages/optimistic-thread-messages";
import { dedupeWhatsappOutboundThreadRows, isWahaEditableMessage, contactThreadRowsEqual } from "@/lib/contact-messages/whatsapp-mirror-preview";
import { editWahaMessageClient } from "@/lib/contact-messages/waha-typing-client";
import {
  applyConversationReadFilterToSearchParams,
  filterConversationsByRead,
  filterContactConversations,
  parseConversationReadFilter,
  type ConversationReadFilter,
} from "@/lib/contact-messages/filter-conversations";
import {
  clampListPage,
  LIST_PAGE_SIZE_DEFAULT,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
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
  inboxLinkContactErrorMessage,
  inboxLinkContactImportWarning,
} from "@/lib/contact-messages/inbox-link-contact-errors";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import {
  sendContactMessageUserMessage,
  triggerEmailInboxSend,
  triggerLinkEmailThreadToContact,
  triggerLinkMetaThreadToContact,
  triggerLinkWahaThreadToContact,
  triggerMetaSendMessage,
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
  isMetaPseudoContactId,
  metaPlatformFromPseudoContactId,
  metaPseudoContactId,
} from "@/lib/contact-messages/meta-pseudo-contact";
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
import { useContactThreadRealtime } from "@/lib/hooks/use-contact-thread-realtime";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import { useRestaurantProfile } from "@/lib/contexts/restaurant-profile-context";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import {
  contactThreadDisplayName,
  fetchContactById,
  findContactByEmailNormalized,
  findContactByPhoneNormalized,
  hasMessagingPlatform,
  primaryEmail,
  primaryPhone,
} from "@/lib/supabase/contacts-db";
import {
  fetchContactMessages,
  fetchContactConversations,
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
  if (attachmentKind === "video") return "Video";
  if (attachmentKind === "voice") return "Sprachnachricht";
  if (attachmentKind === "file") return "Datei";
  return "—";
}

/** Inbox-Pseudo-Chat (noch nicht mit Gwada-Kontakt verknüpft). */
function isInboxPseudoContactId(contactId: string): boolean {
  return (
    isWahaPseudoContactId(contactId) ||
    isEmailPseudoContactId(contactId) ||
    isMetaPseudoContactId(contactId)
  );
}

type PendingInboxLink = {
  platform: "whatsapp" | "email" | "facebook" | "instagram";
  pseudoContactId: string;
};

function platformInferredFromContact(
  contactId: string | null,
): ContactMessagePlatform | null {
  if (!contactId) return null;
  if (isWahaPseudoContactId(contactId)) return "whatsapp";
  if (isEmailPseudoContactId(contactId)) return "email";
  return metaPlatformFromPseudoContactId(contactId);
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
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const threadRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [contactName, setContactName] = useState("");
  const [hasPhone, setHasPhone] = useState(false);
  const [hasEmail, setHasEmail] = useState(false);
  const [hasFacebookId, setHasFacebookId] = useState(false);
  const [hasInstagramId, setHasInstagramId] = useState(false);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadHasMore, setThreadHasMore] = useState(false);
  const [threadOldestCursor, setThreadOldestCursor] = useState<string | null>(
    null,
  );
  const [loadingOlderMessages, setLoadingOlderMessages] = useState(false);
  const [threadOverlayOpen, setThreadOverlayOpen] = useState(false);
  const [closingThreadId, setClosingThreadId] = useState<string | null>(null);
  const overlayThreadId = contactParam ?? closingThreadId;
  const [sending, setSending] = useState(false);
  const [editingWahaMessage, setEditingWahaMessage] = useState<{
    messageId: string;
    initialBody: string;
  } | null>(null);
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
  const [assignInboxThread, setAssignInboxThread] = useState<{
    pseudoContactId: string;
    displayName: string;
  } | null>(null);
  const [assigningInboxThread, setAssigningInboxThread] = useState(false);
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationForDrawer, setReservationForDrawer] =
    useState<ReservationListRow | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [readFilter, setReadFilter] = useState<ConversationReadFilter>(() =>
    parseConversationReadFilter(readParam),
  );
  const [chatListPage, setChatListPage] = useState(1);
  const [refreshingInbox, setRefreshingInbox] = useState(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    setChatSearch("");
    setReadFilter("all");
    setChatListPage(1);
  }, [inboxFilter]);

  useEffect(() => {
    setChatListPage(1);
  }, [chatSearch, readFilter]);

  useEffect(() => {
    if (contactParam) {
      setThreadOverlayOpen(true);
      setClosingThreadId(null);
    }
  }, [contactParam]);

  useEffect(() => {
    setEditingWahaMessage(null);
  }, [contactParam]);

  const applyContactThreadCache = useCallback(
    (restaurantUuid: string, threadContactId: string) => {
      const cached = peekContactThreadCache(restaurantUuid, threadContactId);
      if (!cached?.messages.length) return false;
      setMessages(cached.messages);
      setContactName(cached.contactName);
      setHasPhone(cached.hasPhone);
      setHasEmail(cached.hasEmail);
      setHasFacebookId(cached.hasFacebookId ?? false);
      setHasInstagramId(cached.hasInstagramId ?? false);
      setWhatsappThreadChatId(cached.whatsappThreadChatId);
      setLoadingThread(false);
      return true;
    },
    [],
  );

  const resetThreadForLoad = useCallback(() => {
    setMessages([]);
    setWhatsappThreadPhone(null);
    setWhatsappThreadChatId(null);
    setHasPhone(false);
    setHasEmail(false);
    setHasFacebookId(false);
    setHasInstagramId(false);
    setThreadHasMore(false);
    setThreadOldestCursor(null);
    setLoadingOlderMessages(false);
    setLoadingThread(true);
  }, []);

  const filteredConversations = useMemo(() => {
    const byPlatform = filterInboxConversationsByPlatform(
      conversations,
      inboxFilter,
    );
    const searched = filterContactConversations(byPlatform, chatSearch);
    return filterConversationsByRead(searched, readFilter);
  }, [conversations, chatSearch, readFilter, inboxFilter]);

  const chatListTotalCount = filteredConversations.length;
  const chatListTotalPages = totalPagesFromCount(
    chatListTotalCount,
    LIST_PAGE_SIZE_DEFAULT,
  );
  const currentChatListPage = clampListPage(chatListPage, chatListTotalPages);
  const paginatedConversations = useMemo(() => {
    const from = (currentChatListPage - 1) * LIST_PAGE_SIZE_DEFAULT;
    return filteredConversations.slice(from, from + LIST_PAGE_SIZE_DEFAULT);
  }, [filteredConversations, currentChatListPage]);

  const linkedThread =
    Boolean(contactParam) && isLinkedContactId(contactParam!);

  const displayMessages = useMemo(() => {
    let rows = enrichMessagesWithWahaReactionIds(messages);
    rows = dedupeWhatsappOutboundThreadRows(rows);
    rows = dropOptimisticMatchingAnchors(rows);
    if (!contactParam) return rows;
    return rows.filter((m) => m.contact_id === contactParam);
  }, [messages, contactParam]);

  const inferredReachability = useMemo(
    () => inferContactReachabilityFromMessages(displayMessages),
    [displayMessages],
  );

  const effectiveHasPhone = hasPhone || inferredReachability.hasPhone;
  const effectiveHasEmail = hasEmail || inferredReachability.hasEmail;
  const effectiveHasFacebookId =
    hasFacebookId || inferredReachability.hasFacebookId;
  const effectiveHasInstagramId =
    hasInstagramId || inferredReachability.hasInstagramId;

  const linkedReplyChannels = useMemo(() => {
    if (!linkedThread || !contactParam) {
      return {
        canWhatsapp: false,
        canEmail: false,
        canFacebook: false,
        canInstagram: false,
        emailViaPlatformFallback: false,
      };
    }
    return contactReplyChannels({
      whatsappEnabled,
      whatsappConnected,
      emailEnabled,
      emailConnected,
      staffInviteEmailAvailable,
      facebookEnabled,
      facebookConnected,
      instagramEnabled,
      instagramConnected,
      hasPhone: isWahaPseudoContactId(contactParam)
        ? true
        : effectiveHasPhone,
      hasEmail: isEmailPseudoContactId(contactParam) ? true : effectiveHasEmail,
      hasFacebookId: effectiveHasFacebookId,
      hasInstagramId: effectiveHasInstagramId,
    });
  }, [
    linkedThread,
    contactParam,
    whatsappEnabled,
    whatsappConnected,
    emailEnabled,
    emailConnected,
    staffInviteEmailAvailable,
    facebookEnabled,
    facebookConnected,
    instagramEnabled,
    instagramConnected,
    effectiveHasPhone,
    effectiveHasEmail,
    effectiveHasFacebookId,
    effectiveHasInstagramId,
  ]);

  const defaultReplySend = useMemo(
    () =>
      inboxReplySendDefaults(displayMessages, {
        canWhatsapp: linkedReplyChannels.canWhatsapp,
        canEmail: linkedReplyChannels.canEmail,
        canFacebook: linkedReplyChannels.canFacebook,
        canInstagram: linkedReplyChannels.canInstagram,
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
          void loadConversations({ silent: true, force: true });
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
        facebookConnected,
        instagramConnected,
      });
      if (error) toast.error(error.message);
      setConversations(data);
    } else if (
      (inboxFilter === "whatsapp" && !whatsappConnected) ||
      (inboxFilter === "email" && !emailConnected) ||
      (inboxFilter === "facebook" && !facebookConnected) ||
      (inboxFilter === "instagram" && !instagramConnected)
    ) {
      setConversations([]);
    } else {
      const platform = inboxFilter as ContactMessagePlatform;
      const { data, error } = await fetchContactConversations({
        restaurantId,
        platform,
      });
      if (error) {
        toast.error(error.message);
        setConversations([]);
      } else {
        const enriched = await enrichConversationsWithReadState({
          restaurantId,
          platform,
          conversations: data,
        });
        setConversations(enriched);
      }
    }

    setLoadingList(false);
  }, [
    restaurantId,
    inboxFilter,
    whatsappConnected,
    emailConnected,
    facebookConnected,
    instagramConnected,
  ]);

  const refreshInbox = useCallback(async () => {
    if (!restaurantId) return;
    setRefreshingInbox(true);
    try {
      if (isUnifiedInboxFilter(inboxFilter)) {
        await refreshUnifiedInboxCache(
          {
            restaurantId,
            whatsappConnected,
            emailConnected,
            facebookConnected,
            instagramConnected,
          },
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
    facebookConnected,
    instagramConnected,
    loadConversations,
  ]);

  const showInboxRefresh =
    !contactParam &&
    (isUnifiedInboxFilter(inboxFilter) ||
      (inboxFilter === "whatsapp" && whatsappConnected) ||
      (inboxFilter === "email" && emailConnected) ||
      (inboxFilter === "facebook" && facebookConnected) ||
      (inboxFilter === "instagram" && instagramConnected));

  const patchConversationReadState = useCallback(
    (contactId: string, isUnread: boolean, unreadCount = 0) => {
      const readPatch = {
        is_unread: isUnread,
        unread_count: unreadCount,
        whatsapp_unread_count: isUnread ? unreadCount : 0,
        email_unread_count: isUnread ? unreadCount : 0,
      };
      setConversations((prev) =>
        prev.map((c) =>
          c.contact_id === contactId ? { ...c, ...readPatch } : c,
        ),
      );
      if (restaurantId) {
        patchUnifiedInboxCacheConversation(restaurantId, contactId, readPatch);
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
                : metaPlatformFromPseudoContactId(conversationKey) ?? "gwada",
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
          : metaPlatformFromPseudoContactId(conversationKey) ?? "gwada";
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

  const threadErrorToast = useCallback((error: string) => {
    if (error === "no_contact_email") {
      return "E-Mail-Verlauf: keine Adresse für diesen Kontakt.";
    }
    if (error === "imap_not_configured") {
      return "E-Mail-Konto ist nicht verbunden.";
    }
    if (error === "waha_not_configured") {
      return "WhatsApp ist nicht verbunden.";
    }
    if (error === "meta_not_connected") {
      return "Meta-Kanal ist nicht verbunden.";
    }
    return `Chat-Verlauf: ${error}`;
  }, []);

  const loadThread = useCallback(async (opts?: { silent?: boolean }) => {
    if (!restaurantId || !contactParam) {
      setMessages([]);
      setWhatsappThreadPhone(null);
      setLoadingThread(false);
      setThreadHasMore(false);
      setThreadOldestCursor(null);
      return;
    }
    if (!opts?.silent) {
      setLoadingThread(true);
      setThreadHasMore(false);
      setThreadOldestCursor(null);
    } else {
      const cachedThread = peekContactThreadCache(restaurantId, contactParam);
      if (!cachedThread?.messages.length) {
        setLoadingThread(true);
      }
    }
    if (!isWahaPseudoContactId(contactParam)) {
      setWhatsappThreadPhone(null);
    }
    if (!linkedThread) {
      setWhatsappThreadChatId(null);
    }

    const convPreview = conversationsRef.current.find(
      (c) => c.contact_id === contactParam,
    );
    const listTitle = wahaThreadTitleFromPreview(convPreview);
    if (listTitle) {
      setContactName(listTitle);
    }

    const pageLimit =
      opts?.silent && messagesRef.current.length > CONTACT_THREAD_PAGE_SIZE
        ? messagesRef.current.length
        : CONTACT_THREAD_PAGE_SIZE;

    const { data, hasMore, oldestCursor, contact, error } =
      await fetchContactThreadPageClient({
        restaurantId,
        contactId: contactParam,
        limit: pageLimit,
      });

    const applyContactMeta = (meta: NonNullable<typeof contact>) => {
      setContactName(meta.name || listTitle || contactName);
      setHasPhone(meta.hasPhone);
      setHasEmail(meta.hasEmail);
      setHasFacebookId(meta.hasFacebookId);
      setHasInstagramId(meta.hasInstagramId);
      if (meta.whatsappThreadChatId) {
        setWhatsappThreadChatId(meta.whatsappThreadChatId);
      }
    };

    if (error) {
      if (contact) applyContactMeta(contact);
      const toastMsg = threadErrorToast(error);
      if (!opts?.silent) {
        toast.error(toastMsg);
        setMessages([]);
      }
      setLoadingThread(false);
      return;
    }

    if (contact) {
      applyContactMeta(contact);
    } else if (isMetaPseudoContactId(contactParam)) {
      const metaPlatform = metaPlatformFromPseudoContactId(contactParam);
      setContactName(
        convPreview?.contact_name ??
          (metaPlatform ? CONTACT_MESSAGE_PLATFORM_LABELS[metaPlatform] : "Chat"),
      );
      setHasPhone(false);
      setHasEmail(false);
    } else if (isEmailPseudoContactId(contactParam)) {
      setContactName(convPreview?.contact_name ?? "E-Mail");
      setHasPhone(false);
      setHasEmail(true);
    } else if (isWahaPseudoContactId(contactParam)) {
      setContactName(
        wahaConversationDisplayName({
          contact_id: contactParam,
          contact_name: convPreview?.contact_name ?? "WhatsApp",
        }),
      );
      setHasPhone(true);
      setHasEmail(false);
      const pseudoChatId = wahaChatIdFromPseudoContactId(contactParam);
      if (pseudoChatId) setWhatsappThreadChatId(pseudoChatId);
    }

    const resolvedName =
      contact?.name ??
      listTitle ??
      convPreview?.contact_name ??
      contactName;

    setMessages((prev) => {
      let next = mergeLoadedThreadWithOptimistic(data, prev);
      next = dropOptimisticMatchingAnchors(next);
      if (contactThreadRowsEqual(prev, next)) return prev;
      setContactThreadCache(restaurantId, contactParam, {
        messages: next,
        contactName: resolvedName,
        hasPhone: contact?.hasPhone ?? false,
        hasEmail: contact?.hasEmail ?? false,
        hasFacebookId: contact?.hasFacebookId ?? false,
        hasInstagramId: contact?.hasInstagramId ?? false,
        whatsappThreadChatId:
          contact?.whatsappThreadChatId ?? whatsappThreadChatId,
      });
      return next;
    });

    setThreadHasMore(hasMore);
    setThreadOldestCursor(oldestCursor);
    setLoadingThread(false);

    if (
      isWahaPseudoContactId(contactParam) ||
      (linkedThread && whatsappConnected)
    ) {
      void resolveWhatsAppThreadPhoneSubtitle({
        restaurantId,
        contactId: contactParam,
        defaultCountryIso2,
        conversationDisplayName: resolvedName,
        contact: null,
        fetchResolvedPhone: fetchWahaResolvedPhoneClient,
      }).then(setWhatsappThreadPhone);
    }

    void markConversationRead(contactParam);
  }, [
    restaurantId,
    contactParam,
    linkedThread,
    whatsappConnected,
    contactName,
    whatsappThreadChatId,
    markConversationRead,
    defaultCountryIso2,
    threadErrorToast,
  ]);

  const loadOlderThreadMessages = useCallback(async () => {
    if (
      !restaurantId ||
      !contactParam ||
      !threadOldestCursor ||
      loadingOlderMessages ||
      !threadHasMore
    ) {
      return;
    }
    setLoadingOlderMessages(true);
    const { data, hasMore, oldestCursor, error } =
      await fetchContactThreadPageClient({
        restaurantId,
        contactId: contactParam,
        before: threadOldestCursor,
        limit: CONTACT_THREAD_PAGE_SIZE,
      });
    setLoadingOlderMessages(false);
    if (error) {
      toast.error(threadErrorToast(error));
      return;
    }
    setMessages((prev) =>
      dedupeContactMessagesById([...data, ...prev]),
    );
    setThreadHasMore(hasMore);
    setThreadOldestCursor(oldestCursor);
  }, [
    restaurantId,
    contactParam,
    threadOldestCursor,
    loadingOlderMessages,
    threadHasMore,
    threadErrorToast,
  ]);

  const reconcileWhatsappThreadAfterSend = useCallback(async () => {
    if (!restaurantId || !contactParam) return;
    void loadThread({ silent: true });
  }, [restaurantId, contactParam, loadThread]);

  const patchThreadCache = useCallback(
    (next: ContactMessageRow[]) => {
      if (!restaurantId || !contactParam) return;
      setContactThreadCache(restaurantId, contactParam, {
        messages: next,
        contactName,
        hasPhone,
        hasEmail,
        hasFacebookId,
        hasInstagramId,
        whatsappThreadChatId,
      });
    },
    [
      restaurantId,
      contactParam,
      contactName,
      hasPhone,
      hasEmail,
      hasFacebookId,
      hasInstagramId,
      whatsappThreadChatId,
    ],
  );

  const applyRealtimeThreadInsert = useCallback(
    (row: ContactMessageRow) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        let next = dedupeContactMessagesById([...prev, row]);
        next = dropOptimisticMatchingAnchors(next);
        if (contactThreadRowsEqual(prev, next)) return prev;
        patchThreadCache(next);
        return next;
      });
    },
    [patchThreadCache],
  );

  const applyRealtimeThreadUpdate = useCallback(
    (row: ContactMessageRow) => {
      setMessages((prev) => {
        const idx = prev.findIndex((m) => m.id === row.id);
        if (idx === -1) return prev;
        const next = [...prev];
        next[idx] = {
          ...next[idx]!,
          ...row,
          attachments: next[idx]!.attachments ?? row.attachments,
        };
        if (contactThreadRowsEqual(prev, next)) return prev;
        patchThreadCache(next);
        return next;
      });
    },
    [patchThreadCache],
  );

  useContactThreadRealtime(contactParam, {
    onInsert: applyRealtimeThreadInsert,
    onUpdate: applyRealtimeThreadUpdate,
  });

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
    if (!restaurantId) return;

    const onMessagesRefresh = () => {
      void loadConversations({ silent: true, force: true });
    };

    window.addEventListener(GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT, onMessagesRefresh);
    return () => {
      window.removeEventListener(
        GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT,
        onMessagesRefresh,
      );
      if (threadRefreshDebounceRef.current) {
        clearTimeout(threadRefreshDebounceRef.current);
        threadRefreshDebounceRef.current = null;
      }
    };
  }, [
    restaurantId,
    contactParam,
    loadConversations,
  ]);

  useLayoutEffect(() => {
    if (!restaurantId) return;
    const cached = peekUnifiedInboxCache(restaurantId);
    if (cached?.length) {
      setConversations(cached);
      setLoadingList(false);
    }
  }, [restaurantId]);

  useLayoutEffect(() => {
    if (!restaurantId || !contactParam) {
      if (!contactParam) setLoadingThread(false);
      return;
    }
    if (!applyContactThreadCache(restaurantId, contactParam)) {
      resetThreadForLoad();
    }
  }, [
    applyContactThreadCache,
    contactParam,
    resetThreadForLoad,
    restaurantId,
  ]);

  useEffect(() => {
    if (!restaurantId || connectionsLoading) return;

    if (!contactParam) {
      const hasInboxCache = Boolean(peekUnifiedInboxCache(restaurantId)?.length);
      void loadConversations(hasInboxCache ? { silent: true } : undefined);
      return;
    }

    const cached = peekContactThreadCache(restaurantId, contactParam);
    void loadThread({
      silent: Boolean(cached && cached.messages.length > 0),
    });
  }, [
    contactParam,
    connectionsLoading,
    restaurantId,
    loadThread,
    loadConversations,
  ]);

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

  const navigateToContactThread = useCallback(
    (contactId: string, opts?: { displayName?: string }) => {
      if (!restaurantId) return;
      deleteContactThreadCacheEntry(restaurantId, contactId);
      setMessages([]);
      setLoadingThread(true);
      setWhatsappThreadPhone(null);
      setWhatsappThreadChatId(null);
      if (opts?.displayName) setContactName(opts.displayName);
      const params = new URLSearchParams();
      params.set("platform", INBOX_FILTER_ALL);
      params.set("contact", contactId);
      router.replace(`/dashboard/kontakte/nachrichten?${params.toString()}`);
    },
    [restaurantId, router],
  );

  const linkMetaThreadToExistingContact = useCallback(
    async (
      pseudoContactId: string,
      existingContactId: string,
      existingDisplayName: string,
    ) => {
      if (!restaurantId) return false;
      const link = await triggerLinkMetaThreadToContact({
        restaurantId,
        metaContactId: pseudoContactId,
        contactId: existingContactId,
      });
      if (link?.ok) {
        const n = link.imported ?? 0;
        const platform = metaPlatformFromPseudoContactId(pseudoContactId);
        const label =
          platform === "instagram" ? "Instagram" : "Messenger";
        const importWarn = inboxLinkContactImportWarning(
          link.messageImportError ?? undefined,
        );
        if (importWarn) {
          toast.warning(importWarn);
        } else {
          toast.success(
            n > 0
              ? `${label}-Chat mit „${existingDisplayName}“ verknüpft (${n} Nachrichten importiert).`
              : `${label}-Chat mit „${existingDisplayName}“ verknüpft.`,
          );
        }
        navigateToContactThread(existingContactId, {
          displayName: existingDisplayName,
        });
        return true;
      }
      toast.warning(inboxLinkContactErrorMessage(link?.error));
      return false;
    },
    [restaurantId, navigateToContactThread],
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
        navigateToContactThread(existingContactId, {
          displayName: existingDisplayName,
        });
        return true;
      }
      toast.warning(inboxLinkContactErrorMessage(link?.error));
      return false;
    },
    [restaurantId, navigateToContactThread],
  );

  const linkEmailThreadToExistingContact = useCallback(
    async (
      pseudoContactId: string,
      existingContactId: string,
      existingDisplayName: string,
    ) => {
      if (!restaurantId) return false;
      const link = await triggerLinkEmailThreadToContact({
        restaurantId,
        emailPseudoContactId: pseudoContactId,
        contactId: existingContactId,
      });
      if (link?.ok) {
        const n = link.imported ?? 0;
        toast.success(
          n > 0
            ? `E-Mail-Chat mit „${existingDisplayName}“ verknüpft (${n} Nachrichten importiert).`
            : `E-Mail-Chat mit „${existingDisplayName}“ verknüpft.`,
        );
        navigateToContactThread(existingContactId, {
          displayName: existingDisplayName,
        });
        return true;
      }
      if (link?.error === "email_on_other_contact") {
        toast.warning(inboxLinkContactErrorMessage(link.error));
      } else {
        toast.warning(inboxLinkContactErrorMessage(link?.error));
      }
      return false;
    },
    [restaurantId, navigateToContactThread],
  );

  const assignInboxThreadToContact = useCallback(
    async (targetContactId: string, targetDisplayName: string) => {
      const thread = assignInboxThread;
      if (!thread || !restaurantId) return;

      setAssigningInboxThread(true);
      try {
        const { pseudoContactId } = thread;
        let ok = false;
        if (isWahaPseudoContactId(pseudoContactId)) {
          ok = await linkWahaThreadToExistingContact(
            pseudoContactId,
            targetContactId,
            targetDisplayName,
          );
        } else if (isMetaPseudoContactId(pseudoContactId)) {
          ok = await linkMetaThreadToExistingContact(
            pseudoContactId,
            targetContactId,
            targetDisplayName,
          );
        } else if (isEmailPseudoContactId(pseudoContactId)) {
          ok = await linkEmailThreadToExistingContact(
            pseudoContactId,
            targetContactId,
            targetDisplayName,
          );
        }
        if (ok) {
          setAssignInboxThread(null);
          void loadConversations();
        }
      } finally {
        setAssigningInboxThread(false);
      }
    },
    [
      assignInboxThread,
      linkEmailThreadToExistingContact,
      linkMetaThreadToExistingContact,
      linkWahaThreadToExistingContact,
      loadConversations,
      restaurantId,
    ],
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

      if (isMetaPseudoContactId(pseudoContactId)) {
        const platform = metaPlatformFromPseudoContactId(pseudoContactId);
        if (platform !== "facebook" && platform !== "instagram") return;
        setPendingInboxLink({ platform, pseudoContactId });
        setContactCreateDraft({
          firstName: displayName.split(/\s+/)[0] || displayName || platform,
          lastName: displayName.split(/\s+/).slice(1).join(" ") || "",
        });
        setEditContactId(null);
        setContactDrawerOpen(true);
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
    [defaultCountryIso2, linkWahaThreadToExistingContact, restaurantId],
  );

  const openConversation = (contactId: string) => {
    const cached =
      restaurantId && peekContactThreadCache(restaurantId, contactId);
    const preview = conversationsRef.current.find(
      (c) => c.contact_id === contactId,
    );
    if (cached && cached.messages.length > 0) {
      setMessages(cached.messages);
      setContactName(cached.contactName);
      setHasPhone(cached.hasPhone);
      setHasEmail(cached.hasEmail);
      setHasFacebookId(cached.hasFacebookId ?? false);
      setHasInstagramId(cached.hasInstagramId ?? false);
      setWhatsappThreadChatId(cached.whatsappThreadChatId);
      setLoadingThread(false);
    } else {
      setHasPhone(false);
      setHasEmail(false);
      setHasFacebookId(false);
      setHasInstagramId(false);
      const previewTitle =
        preview?.contact_name?.trim() ||
        wahaThreadTitleFromPreview(preview) ||
        "";
      if (previewTitle) setContactName(previewTitle);
      setMessages([]);
      setWhatsappThreadPhone(null);
      setWhatsappThreadChatId(null);
      setLoadingThread(true);
    }

    setThreadOverlayOpen(true);
    setClosingThreadId(null);

    const params = new URLSearchParams(searchParams.toString());
    params.set("platform", inboxFilter);
    params.set("contact", contactId);
    router.push(`/dashboard/kontakte/nachrichten?${params.toString()}`);
  };

  const backToList = useCallback(() => {
    setThreadOverlayOpen(false);
    if (contactParam) {
      setClosingThreadId(contactParam);
      const params = new URLSearchParams();
      params.set("platform", inboxFilter);
      applyConversationReadFilterToSearchParams(params, readFilter);
      router.replace(`/dashboard/kontakte/nachrichten?${params.toString()}`);
    }
    window.setTimeout(() => {
      setClosingThreadId(null);
    }, CONTACT_INBOX_THREAD_OVERLAY_MS);
  }, [contactParam, inboxFilter, readFilter, router]);

  const restaurantName = profile.name.trim() || undefined;
  const canSendViaExternal =
    Boolean(contactParam) &&
    linkedThread &&
    (linkedReplyChannels.canWhatsapp ||
      linkedReplyChannels.canEmail ||
      linkedReplyChannels.canFacebook ||
      linkedReplyChannels.canInstagram);

  const metaThreadPlatform = useMemo((): "facebook" | "instagram" | null => {
    if (!contactParam) return null;
    const p = metaPlatformFromPseudoContactId(contactParam);
    return p === "facebook" || p === "instagram" ? p : null;
  }, [contactParam]);

  const canReply =
    contactParam != null &&
    (linkedThread
      ? canSendViaExternal
      : isWahaPseudoContactId(contactParam)
        ? whatsappConnected
        : isEmailPseudoContactId(contactParam)
          ? emailConnected
          : isMetaPseudoContactId(contactParam)
            ? metaThreadPlatform === "facebook"
              ? facebookConnected
              : metaThreadPlatform === "instagram"
                ? instagramConnected
                : false
            : false);

  const showReplyComposer = canReply || (linkedThread && loadingThread);
  const showReplyBlockedHint =
    linkedThread && !canReply && !loadingThread;

  const handleStartEditWahaMessage = useCallback((message: ContactMessageRow) => {
    if (!message.waha_message_id || !isWahaEditableMessage(message)) return;
    const text = message.body.trim();
    if (!text) return;
    setEditingWahaMessage({
      messageId: message.waha_message_id,
      initialBody: text,
    });
  }, []);

  const handleEditWhatsapp = async ({
    messageId,
    body,
  }: {
    messageId: string;
    body: string;
  }) => {
    if (!restaurantId || !whatsappThreadChatId || !contactParam) return;
    const trimmed = body.trim();
    if (!trimmed) return;
    const previousBody = editingWahaMessage?.initialBody;

    setMessages((prev) => patchWhatsappMessageByWahaId(prev, messageId, trimmed));
    setEditingWahaMessage(null);

    setSending(true);
    try {
      const result = await editWahaMessageClient({
        restaurantId,
        chatId: whatsappThreadChatId,
        messageId,
        text: trimmed,
        contactId: contactParam,
        previousText: previousBody,
      });
      if (!result.ok) {
        if (previousBody) {
          setMessages((prev) =>
            patchWhatsappMessageByWahaId(prev, messageId, previousBody),
          );
        }
        toast.error(
          result.error === "waha_not_configured"
            ? "WhatsApp ist nicht verbunden."
            : "Nachricht konnte nicht geändert werden.",
        );
        return;
      }
      toast.success("WhatsApp-Nachricht geändert.");
      void loadConversations({ silent: true });
    } finally {
      setSending(false);
    }
  };

  const handleOptimisticDeleteWahaMessage = useCallback(
    (message: ContactMessageRow) => {
      if (!message.waha_message_id) return;
      setMessages((prev) =>
        removeWhatsappMessageByWahaId(prev, message.waha_message_id!),
      );
    },
    [],
  );

  const handleWahaReactionChange = useCallback(() => {
    void loadThread({ silent: true });
  }, [loadThread]);

  const handleWahaMessageDeleted = useCallback(() => {
    void loadConversations({ silent: true });
  }, [loadConversations]);

  const handleMetaReactionChange = useCallback(() => {
    void loadThread({ silent: true });
    void loadConversations({ silent: true });
  }, [loadThread, loadConversations]);

  const hasWahaMessagesInThread = useMemo(
    () => displayMessages.some((m) => m.waha_message_id),
    [displayMessages],
  );

  const wahaReactionsConfig = useMemo((): ContactMessageWahaReactionsConfig | undefined => {
    if (!restaurantId || !whatsappThreadChatId) return undefined;
    const showWaha =
      (linkedThread && hasWahaMessagesInThread) ||
      isWahaPseudoContactId(overlayThreadId ?? "");
    if (!showWaha) return undefined;
    return {
      restaurantId,
      chatId: whatsappThreadChatId,
      onReactionChange: handleWahaReactionChange,
      onMessageDeleted: handleWahaMessageDeleted,
      onOptimisticMessageDelete: handleOptimisticDeleteWahaMessage,
      onEditMessage: handleStartEditWahaMessage,
      editingMessageId: editingWahaMessage?.messageId ?? null,
    };
  }, [
    restaurantId,
    whatsappThreadChatId,
    linkedThread,
    hasWahaMessagesInThread,
    overlayThreadId,
    handleWahaReactionChange,
    handleWahaMessageDeleted,
    handleOptimisticDeleteWahaMessage,
    handleStartEditWahaMessage,
    editingWahaMessage?.messageId,
  ]);

  const metaReactionsConfig = useMemo((): ContactMessageMetaReactionsConfig | undefined => {
    if (!restaurantId) return undefined;
    if (!isMetaPseudoContactId(overlayThreadId ?? "") && !linkedThread) {
      return undefined;
    }
    return {
      restaurantId,
      onReactionChange: handleMetaReactionChange,
    };
  }, [restaurantId, overlayThreadId, linkedThread, handleMetaReactionChange]);

  const handleSend = async ({
    body,
    sendWhatsapp,
    sendEmail,
    sendFacebook,
    sendInstagram,
    files,
    voiceNote,
  }: {
    body: string;
    sendWhatsapp: boolean;
    sendEmail: boolean;
    sendFacebook: boolean;
    sendInstagram: boolean;
    files?: File[];
    voiceNote?: File;
  }) => {
    if (!restaurantId || !contactParam || !canReply) return;

    setSending(true);

    if (linkedThread) {
      if (
        !sendWhatsapp &&
        !sendEmail &&
        !sendFacebook &&
        !sendInstagram &&
        !voiceNote
      ) {
        setSending(false);
        toast.error(
          "Mindestens einen Kanal auswählen — Antworten nur über externe Kanäle.",
        );
        return;
      }
      if (
        voiceNote &&
        !sendWhatsapp &&
        !sendFacebook &&
        !sendInstagram
      ) {
        setSending(false);
        toast.error(
          "Sprachnachrichten nur über WhatsApp, Messenger oder Instagram.",
        );
        return;
      }
      const channels: (
        | "whatsapp"
        | "email"
        | "facebook"
        | "instagram"
      )[] = [];
      if (voiceNote) {
        if (sendWhatsapp) channels.push("whatsapp");
        else if (sendFacebook) channels.push("facebook");
        else if (sendInstagram) channels.push("instagram");
      } else {
        if (sendWhatsapp) channels.push("whatsapp");
        if (sendEmail && body.trim()) channels.push("email");
        if (sendFacebook) channels.push("facebook");
        if (sendInstagram) channels.push("instagram");
      }

      let optimisticWhatsapp: ContactMessageRow | null = null;
      if ((sendWhatsapp || voiceNote) && contactParam) {
        optimisticWhatsapp = createOptimisticOutboundWhatsappMessage({
          restaurantId,
          contactId: contactParam,
          body,
          files,
          voiceNote,
          voicePreviewUrl: voiceNote
            ? URL.createObjectURL(voiceNote)
            : undefined,
        });
        setMessages((prev) =>
          appendOptimisticMessage(prev, optimisticWhatsapp!),
        );
      }

      const result = await triggerSendContactMessage({
        restaurantId,
        contactId: contactParam,
        messageBody: body,
        direction: "outbound",
        channels,
        restaurantName,
        files,
        voiceNote,
      });
      setSending(false);
      if (optimisticWhatsapp && !result?.ok) {
        setMessages((prev) =>
          removeOptimisticMessage(prev, optimisticWhatsapp!.id),
        );
      }
      const warn = sendContactMessageUserMessage(result);
      if (warn) toast.warning(warn);
      else if (result?.ok) toast.success("Nachricht gesendet.");
      else toast.error("Senden fehlgeschlagen.");
      if (result?.ok) {
        if (sendWhatsapp || (voiceNote && sendWhatsapp)) {
          void reconcileWhatsappThreadAfterSend();
        } else {
          void loadThread({ silent: true });
        }
        void loadConversations({ silent: true });
      }
      return;
    }

    if (isWahaPseudoContactId(contactParam)) {
      let optimisticWhatsapp: ContactMessageRow | null = null;
      optimisticWhatsapp = createOptimisticOutboundWhatsappMessage({
        restaurantId,
        contactId: contactParam,
        body,
        files,
        voiceNote,
        voicePreviewUrl: voiceNote ? URL.createObjectURL(voiceNote) : undefined,
      });
      setMessages((prev) => appendOptimisticMessage(prev, optimisticWhatsapp!));

      const result = await triggerWahaSendMessage({
        restaurantId,
        wahaContactId: contactParam,
        messageBody: body,
        files,
        voiceNote,
      });
      setSending(false);
      if (!result?.ok) {
        setMessages((prev) =>
          removeOptimisticMessage(prev, optimisticWhatsapp!.id),
        );
      }
      const warn = sendContactMessageUserMessage(result);
      if (warn) toast.warning(warn);
      else if (result?.ok) toast.success("WhatsApp-Nachricht gesendet.");
      else toast.error("Senden fehlgeschlagen.");
      if (result?.ok) {
        void reconcileWhatsappThreadAfterSend();
        void loadConversations({ silent: true });
      }
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

    if (isMetaPseudoContactId(contactParam) && metaThreadPlatform) {
      let optimisticMeta: ContactMessageRow | null = null;
      optimisticMeta = createOptimisticOutboundMetaMessage({
        restaurantId,
        contactId: contactParam,
        platform: metaThreadPlatform,
        body,
        files,
        voiceNote,
        voicePreviewUrl: voiceNote ? URL.createObjectURL(voiceNote) : undefined,
      });
      setMessages((prev) => appendOptimisticMessage(prev, optimisticMeta!));

      const result = await triggerMetaSendMessage({
        restaurantId,
        metaContactId: contactParam,
        messageBody: body,
        files,
        voiceNote,
      });
      setSending(false);
      if (!result?.ok) {
        setMessages((prev) =>
          removeOptimisticMessage(prev, optimisticMeta!.id),
        );
      }
      const warn = sendContactMessageUserMessage(result);
      if (warn) toast.warning(warn);
      else if (result?.ok) {
        toast.success(
          metaThreadPlatform === "instagram"
            ? "Instagram-Nachricht gesendet."
            : "Messenger-Nachricht gesendet.",
        );
      } else toast.error("Senden fehlgeschlagen.");
      if (result?.ok) {
        void loadThread({ silent: true });
        void loadConversations({ silent: true });
      }
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
      {!contactParam ? (
        <>
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
        </>
      ) : null}

      {overlayThreadId ? (
        <ContactInboxThreadOverlay
          open={threadOverlayOpen}
          onClose={backToList}
          aria-label={contactName ? `Chat mit ${contactName}` : "Chat"}
          header={
            <div className="flex items-center gap-2 px-4 py-3 sm:px-5">
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
                {canOpenLinkedContact(overlayThreadId) ? (
                  <button
                    type="button"
                    className="max-w-full truncate text-left text-base font-semibold tracking-tight hover:underline"
                    onClick={() => openLinkedContact(overlayThreadId)}
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
                ) : isWahaPseudoContactId(overlayThreadId) ? (
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
                ) : isEmailPseudoContactId(overlayThreadId) ? (
                  <p className="text-xs text-muted-foreground">E-Mail</p>
                ) : isMetaPseudoContactId(overlayThreadId) ? (
                  <p className="text-xs text-muted-foreground">
                    {CONTACT_MESSAGE_PLATFORM_LABELS[
                      metaPlatformFromPseudoContactId(overlayThreadId) ?? "facebook"
                    ]}
                  </p>
                ) : null}
              </div>
              {isInboxPseudoContactId(overlayThreadId) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  aria-label={
                    isEmailPseudoContactId(overlayThreadId)
                      ? "Kontakt aus E-Mail-Chat anlegen"
                      : isMetaPseudoContactId(overlayThreadId)
                        ? "Kontakt aus Messenger/Instagram-Chat anlegen"
                        : "Kontakt aus WhatsApp-Chat anlegen"
                  }
                  onClick={() =>
                    openCreateContactFromPseudo(
                      overlayThreadId,
                      contactName ||
                        (isEmailPseudoContactId(overlayThreadId)
                          ? "E-Mail"
                          : "WhatsApp"),
                    )
                  }
                >
                  <Plus className="size-4" />
                </Button>
              ) : null}
              {canOpenLinkedContact(overlayThreadId) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  aria-label="Kontakt öffnen"
                  onClick={() => openLinkedContact(overlayThreadId)}
                >
                  <UserRound className="size-4" />
                </Button>
              ) : null}
            </div>
          }
          footer={
            showReplyComposer ? (
              <div className="min-w-0 overflow-visible px-4 py-2 sm:px-5 sm:py-3">
                <ContactMessageComposer
                  disabled={loadingThread || (linkedThread && !canReply)}
                  sending={sending}
                  hasPhone={
                    isWahaPseudoContactId(overlayThreadId)
                      ? true
                      : effectiveHasPhone
                  }
                  hasEmail={
                    isEmailPseudoContactId(overlayThreadId)
                      ? true
                      : effectiveHasEmail
                  }
                  hasFacebook={effectiveHasFacebookId}
                  hasInstagram={effectiveHasInstagramId}
                  whatsappEnabled={whatsappEnabled && whatsappConnected}
                  emailEnabled={
                    emailEnabled &&
                    (emailConnected || staffInviteEmailAvailable)
                  }
                  facebookEnabled={facebookEnabled && facebookConnected}
                  instagramEnabled={instagramEnabled && instagramConnected}
                  emailViaPlatformFallback={
                    linkedReplyChannels.emailViaPlatformFallback
                  }
                  defaultSendWhatsapp={defaultReplySend.whatsapp}
                  defaultSendEmail={defaultReplySend.email}
                  defaultSendFacebook={defaultReplySend.facebook}
                  defaultSendInstagram={defaultReplySend.instagram}
                  variant={
                    linkedThread
                      ? "inbox-reply"
                      : isWahaPseudoContactId(overlayThreadId)
                        ? "whatsapp-only"
                      : isEmailPseudoContactId(overlayThreadId)
                          ? "email-only"
                          : isMetaPseudoContactId(overlayThreadId)
                            ? "meta-only"
                            : "unified"
                  }
                  stickyFooter
                  placeholder={
                    isWahaPseudoContactId(overlayThreadId)
                      ? "WhatsApp-Nachricht …"
                      : isEmailPseudoContactId(overlayThreadId)
                        ? "E-Mail schreiben …"
                        : isMetaPseudoContactId(overlayThreadId) && metaThreadPlatform
                          ? `${CONTACT_MESSAGE_PLATFORM_LABELS[metaThreadPlatform]}-Nachricht …`
                          : "Antwort schreiben …"
                  }
                  whatsappTyping={
                    restaurantId &&
                    whatsappThreadChatId &&
                    !editingWahaMessage &&
                    (linkedThread
                      ? defaultReplySend.whatsapp
                      : isWahaPseudoContactId(overlayThreadId))
                      ? {
                          restaurantId,
                          chatId: whatsappThreadChatId,
                        }
                      : null
                  }
                  editWhatsappMessage={editingWahaMessage}
                  onEditWhatsapp={handleEditWhatsapp}
                  onCancelEditWhatsapp={() => setEditingWahaMessage(null)}
                  onSend={handleSend}
                />
              </div>
            ) : showReplyBlockedHint ? (
              <div className="px-4 py-4 sm:px-5">
                <p className="text-sm text-muted-foreground">
                  {!emailEnabled &&
                  !whatsappEnabled &&
                  !facebookEnabled &&
                  !instagramEnabled
                    ? "Nachrichten-Kanäle sind für dieses Restaurant nicht freigeschaltet."
                    : !staffInviteEmailAvailable &&
                        !emailConnected &&
                        !whatsappConnected &&
                        !facebookConnected &&
                        !instagramConnected
                      ? "Antworten erst möglich, wenn WhatsApp, E-Mail, Messenger oder Instagram unter Einstellungen → Integrationen verbunden ist — oder die Plattform-E-Mail (Gwada-Fallback) aktiv ist."
                      : !effectiveHasEmail &&
                          !effectiveHasPhone &&
                          !effectiveHasFacebookId &&
                          !effectiveHasInstagramId
                        ? "Kontakt braucht Telefon (WhatsApp), E-Mail oder eine verknüpfte Messenger-/Instagram-ID."
                        : !effectiveHasEmail &&
                            !effectiveHasFacebookId &&
                            !effectiveHasInstagramId &&
                            !effectiveHasPhone
                          ? "Für E-Mail-Antworten (auch über Gwada-Fallback) eine E-Mail am Kontakt hinterlegen."
                          : !effectiveHasPhone &&
                              !whatsappConnected &&
                              !effectiveHasFacebookId &&
                              !effectiveHasInstagramId
                            ? "Für WhatsApp eine Telefonnummer hinterlegen und WhatsApp verbinden — oder Messenger/Instagram über einen Meta-Chat verknüpfen."
                            : "Kein Versandweg verfügbar — Kanäle und Kontaktdaten prüfen."}
                </p>
              </div>
            ) : null
          }
        >
          <div className="flex h-full min-h-0 flex-col px-4 pt-4 sm:px-5 sm:pt-5">
            <ContactMessageChatViewport
              messages={displayMessages}
              loading={loadingThread}
              threadKey={overlayThreadId}
              className="h-full min-h-0 flex-1"
              hasMoreOlder={threadHasMore}
              loadingOlder={loadingOlderMessages}
              onLoadOlder={() => void loadOlderThreadMessages()}
              onReservationOpen={(id) => void openReservationFromMessage(id)}
              wahaReactions={wahaReactionsConfig}
              metaReactions={metaReactionsConfig}
            />
          </div>
        </ContactInboxThreadOverlay>
      ) : null}

      {showConversationList ? (
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
              <ListPaginationSurround
                classNameAbove="px-4 pt-3 sm:px-6"
                classNameBelow="px-4 pb-4 sm:px-6"
                page={currentChatListPage}
                totalPages={chatListTotalPages}
                shown={paginatedConversations.length}
                totalCount={chatListTotalCount}
                itemLabel="Chats"
                canPrevious={currentChatListPage > 1}
                canNext={currentChatListPage < chatListTotalPages}
                onPrevious={() =>
                  setChatListPage((p) => Math.max(1, p - 1))
                }
                onNext={() =>
                  setChatListPage((p) => Math.min(chatListTotalPages, p + 1))
                }
              >
              <ul className="divide-y divide-border/50">
                {paginatedConversations.map((c) => {
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
                                <>
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
                                  <DropdownMenuItem
                                    onClick={() =>
                                      setAssignInboxThread({
                                        pseudoContactId: c.contact_id,
                                        displayName: listName,
                                      })
                                    }
                                  >
                                    <Link2 className="size-4" aria-hidden />
                                    Bestehendem Kontakt zuordnen
                                  </DropdownMenuItem>
                                </>
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
              </ListPaginationSurround>
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
        stackAboveInboxOverlay={threadOverlayOpen && Boolean(overlayThreadId)}
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

              if (
                pendingInboxLink.platform === "facebook" ||
                pendingInboxLink.platform === "instagram"
              ) {
                const link = await triggerLinkMetaThreadToContact({
                  restaurantId,
                  metaContactId: pendingInboxLink.pseudoContactId,
                  contactId: detail.contactId,
                });
                const label =
                  pendingInboxLink.platform === "instagram"
                    ? "Instagram"
                    : "Messenger";
                if (link?.ok) {
                  const n = link.imported ?? 0;
                  toast.success(
                    n > 0
                      ? `${n} ${label}-Nachrichten mit dem Kontakt verknüpft.`
                      : "Kontakt angelegt.",
                  );
                } else {
                  toast.warning(
                    `Kontakt angelegt, ${label}-Verlauf konnte nicht importiert werden.`,
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

      <InboxThreadAssignContactSheet
        open={assignInboxThread != null}
        onOpenChange={(open) => {
          if (!open) setAssignInboxThread(null);
        }}
        restaurantId={restaurantId}
        threadDisplayName={assignInboxThread?.displayName ?? ""}
        assigning={assigningInboxThread}
        onAssign={assignInboxThreadToContact}
      />
    </div>
  );
}
