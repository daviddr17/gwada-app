"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Link2,
  MailOpen,
  Mail,
  Maximize2,
  Minimize2,
  MoreVertical,
  RefreshCw,
  UserPlus,
  UserRound,
} from "lucide-react";
import { ContactConversationsListSkeleton } from "@/components/contacts/contact-conversations-list-skeleton";
import {
  contactInboxConversationRowClassName,
  contactInboxConversationRowOpenButtonClassName,
} from "@/components/contacts/contact-inbox-conversation-row-classes";
import {
  inboxUnreadAvatarClassName,
  inboxUnreadCountBadgeClassName,
  inboxUnreadDotClassName,
  inboxUnreadHintLabel,
  inboxUnreadNameClassName,
  inboxUnreadRowBackgroundClassName,
  inboxUnreadRowStripeClassName,
  inboxUnreadStatusChipClassName,
  inboxUnreadStatusChipLabel,
} from "@/lib/contact-messages/inbox-unread-hint-ui";
import { ContactThreadHeaderAvatar } from "@/components/contacts/contact-thread-header-avatar";
import { ContactConversationsReadFilter } from "@/components/contacts/contact-conversations-read-filter";
import { ContactConversationsSearchBar } from "@/components/contacts/contact-conversations-search-bar";
import { toast } from "sonner";
import { ContactMessageProtocolDrawer } from "@/components/contacts/contact-message-protocol-drawer";
import { ContactEditDrawer } from "@/components/contacts/contact-edit-drawer";
import { InboxThreadAssignContactSheet } from "@/components/contacts/inbox-thread-assign-contact-sheet";
import {
  InboxThreadAssignStaffSheet,
  type InboxThreadAssignStaffKind,
} from "@/components/contacts/inbox-thread-assign-staff-sheet";
import { ContactInboxThreadHeaderMenu } from "@/components/contacts/contact-inbox-thread-header-menu";
import {
  ContactInboxThreadChrome,
  ContactInboxThreadOverlay,
  CONTACT_INBOX_THREAD_OVERLAY_MS,
} from "@/components/contacts/contact-inbox-thread-overlay";
import type {
  ContactMessageMetaReactionsConfig,
  ContactMessageWahaReactionsConfig,
} from "@/components/contacts/contact-message-bubble-list";
import { ContactMessageChatViewport } from "@/components/contacts/contact-message-chat-viewport";
import {
  ReservationEditDrawer,
  type ReservationEditDrawerCreateContext,
  type ReservationWhatsappDispatchedPayload,
} from "@/components/reservations/reservation-edit-drawer";
import {
  ReviewInvitationSheet,
  type ReviewInvitationGuestPrefill,
} from "@/components/reviews/review-invitation-sheet";
import { buildChatGuestPrefill } from "@/lib/contact-messages/chat-guest-prefill";
import {
  localDateFromYmd,
  reservationHintsFromLastGuestMessage,
} from "@/lib/contact-messages/chat-reservation-prefill";
import { ContactConversationAttachmentIcon } from "@/components/contacts/contact-conversation-attachment-icon";
import { ContactMessageComposer } from "@/components/contacts/contact-message-composer";
import { ContactInboxFilterChips } from "@/components/contacts/contact-inbox-filter-chips";
import { ContactMessagePlatformIcon } from "@/components/contacts/contact-message-platform-chip";
import {
  AppFullscreenOverlay,
} from "@/components/ui/app-fullscreen-overlay";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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
  isUnifiedInboxCacheFresh,
  patchUnifiedInboxCacheConversation,
  peekUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-cache";
import { GWADA_DASHBOARD_MESSAGES_REFRESH_EVENT } from "@/lib/dashboard/dashboard-live-events";
import {
  getUnifiedInboxRefreshInflight,
  refreshUnifiedInboxCache,
} from "@/lib/contact-messages/unified-inbox-background-sync";
import { useIsLgUp } from "@/lib/hooks/use-is-lg-up";
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
import { setInboxLiveToastSuppressedByOpenThread } from "@/lib/contact-messages/inbox-live-toast-gate";
import { fetchContactThreadPageClient } from "@/lib/contact-messages/fetch-contact-thread-client";
import {
  appendOptimisticMessage,
  confirmOptimisticWhatsappMessage,
  createOptimisticOutboundMetaMessage,
  createOptimisticOutboundWhatsappMessage,
  dropOptimisticMatchingAnchors,
  isOptimisticContactMessage,
  mergeLoadedThreadWithOptimistic,
  OPTIMISTIC_MESSAGE_ID_PREFIX,
  patchWhatsappMessageByWahaId,
  removeOptimisticMessage,
  removeWhatsappMessageByWahaId,
} from "@/lib/contact-messages/optimistic-thread-messages";
import { messageDisplayPlatform } from "@/lib/contact-messages/message-display-platform";
import { ensureWhatsappWahaProxyAttachments } from "@/lib/contact-messages/ensure-whatsapp-waha-proxy-attachments";
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
import { conversationThreadKeyFromRow } from "@/lib/contact-messages/conversation-thread-key";
import { isLinkedContactId } from "@/lib/contact-messages/is-linked-contact-id";
import {
  isSilentClientSendResult,
  sendContactMessageUserMessage,
  triggerEmailInboxSend,
  triggerLinkEmailThreadToContact,
  triggerLinkMetaThreadToContact,
  triggerLinkWahaThreadToContact,
  triggerMetaSendMessage,
  triggerSendContactMessage,
  triggerWahaSendMessage,
  type SendContactMessageApiResult,
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
import { useRestaurantPermissions } from "@/lib/hooks/use-restaurant-permissions";
import {
  hasModuleCreate,
  hasModuleRead,
  hasModuleUpdate,
} from "@/lib/permissions/module-crud-permissions";
import { ModuleAccessDenied } from "@/lib/permissions/module-access-denied";
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
import { updateStaff } from "@/lib/supabase/staff-db";
import { dispatchStaffDataRefresh } from "@/lib/staff/staff-live-events";
import { startOfLocalDay } from "@/lib/reservations/month-range";
import {
  fetchReservationById,
  type ReservationListRow,
} from "@/lib/supabase/reservations-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import {
  inboxConversationAvatarInitials,
  inboxConversationAvatarUrl,
} from "@/lib/contacts/inbox-conversation-avatar-initials";
import { ProfileRoundAvatar } from "@/components/ui/profile-round-avatar";
import { pickContactThreadTitle } from "@/lib/contacts/contact-thread-title";
import { stripHtmlToPlainText } from "@/lib/text/strip-html-to-plain-text";
import { moduleTableFullscreenToggleButtonClassName } from "@/lib/ui/module-paginated-data-table";
import { cn } from "@/lib/utils";

const LIST_SILENT_REFRESH_DEBOUNCE_MS = 3_000;

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
  const t = stripHtmlToPlainText(body).replace(/\s+/g, " ").trim();
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
function isInboxPseudoContactId(contactId: string | null | undefined): boolean {
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

function isNachrichtenMessagesPath(pathname: string): boolean {
  return (
    pathname === "/dashboard/kontakte/nachrichten" ||
    pathname.startsWith("/dashboard/kontakte/nachrichten/")
  );
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

function toastContactSendResult(
  result: SendContactMessageApiResult | null,
  successMessage: string,
) {
  if (isSilentClientSendResult(result)) return;
  const warn = sendContactMessageUserMessage(result);
  if (warn) toast.warning(warn);
  else if (result?.ok) toast.success(successMessage);
  else toast.error("Senden fehlgeschlagen.");
}

export function ContactsMessagesScreen({
  active = true,
}: {
  /** Keep-alive: false = versteckt — kein Thread-Realtime / kein Silent-Refetch. */
  active?: boolean;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  pathnameRef.current = pathname;
  const searchParams = useSearchParams();
  const isLgUp = useIsLgUp();
  const activeRef = useRef(active);
  activeRef.current = active;
  const contactParam = searchParams.get("contact");
  const platformParam = searchParams.get("platform");
  const readParam = searchParams.get("read");

  /** Keep-alive: nie Soft-Nav zurückreißen — auch nicht nach async await. */
  const navigateNachrichten = useCallback(
    (href: string, mode: "replace" | "push" = "replace") => {
      if (!activeRef.current) return;
      if (!isNachrichtenMessagesPath(pathnameRef.current)) return;
      if (mode === "push") router.push(href);
      else router.replace(href);
    },
    [router],
  );

  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const { has, loading: permissionsLoading } = useRestaurantPermissions();
  const canRead = hasModuleRead(has, "contacts");
  const canViewMessageProtocol = has("contacts.messages.protocol");
  const canCreateReservation = hasModuleCreate(has, "reservations");
  const canCreateReviewInvite = hasModuleCreate(has, "reviews");
  const canUpdateStaff = hasModuleUpdate(has, "staff");
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
  const listRefreshDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [contactName, setContactName] = useState("");
  const [threadAvatarUrl, setThreadAvatarUrl] = useState<string | null>(null);
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
  const [inboxWorkspaceFullscreen, setInboxWorkspaceFullscreen] = useState(false);
  const closeInboxWorkspaceFullscreen = useCallback(
    () => setInboxWorkspaceFullscreen(false),
    [],
  );
  const [closingThreadId, setClosingThreadId] = useState<string | null>(null);
  /** Sofort nach Klick, bevor Soft-Nav `?contact=` setzt — Split-Pane ohne Wartezeit. */
  const [pendingContactId, setPendingContactId] = useState<string | null>(null);
  const overlayThreadId =
    contactParam ?? pendingContactId ?? closingThreadId;
  const effectiveThreadContactId = overlayThreadId;
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
  const [messageProtocolId, setMessageProtocolId] = useState<string | null>(
    null,
  );
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
  const [assignStaffOpen, setAssignStaffOpen] = useState(false);
  const [assignStaffKind, setAssignStaffKind] =
    useState<InboxThreadAssignStaffKind>("phone");
  const [assignStaffValue, setAssignStaffValue] = useState<string | null>(null);
  const [assigningStaff, setAssigningStaff] = useState(false);
  const [reservationDrawerOpen, setReservationDrawerOpen] = useState(false);
  const [reservationForDrawer, setReservationForDrawer] =
    useState<ReservationListRow | null>(null);
  const [reservationCreateFor, setReservationCreateFor] =
    useState<ReservationEditDrawerCreateContext | null>(null);
  const [reviewInviteOpen, setReviewInviteOpen] = useState(false);
  const [reviewInviteGuest, setReviewInviteGuest] =
    useState<ReviewInvitationGuestPrefill | null>(null);
  const [chatSearch, setChatSearch] = useState("");
  const [readFilter, setReadFilter] = useState<ConversationReadFilter>(() =>
    parseConversationReadFilter(readParam),
  );
  const [chatListPage, setChatListPage] = useState(1);
  const [refreshingInbox, setRefreshingInbox] = useState(false);
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const contactNameRef = useRef(contactName);
  contactNameRef.current = contactName;
  const whatsappThreadChatIdRef = useRef(whatsappThreadChatId);
  whatsappThreadChatIdRef.current = whatsappThreadChatId;

  useEffect(() => {
    setChatSearch("");
    setReadFilter("all");
    setChatListPage(1);
  }, [inboxFilter]);

  useEffect(() => {
    setChatListPage(1);
  }, [chatSearch, readFilter]);

  useEffect(() => {
    if (!active) return;
    if (contactParam) {
      setThreadOverlayOpen(true);
      setClosingThreadId(null);
    }
  }, [active, contactParam]);

  useEffect(() => {
    if (!active) {
      setInboxLiveToastSuppressedByOpenThread(false);
      return;
    }
    setInboxLiveToastSuppressedByOpenThread(Boolean(contactParam));
    return () => setInboxLiveToastSuppressedByOpenThread(false);
  }, [active, contactParam]);

  useEffect(() => {
    setEditingWahaMessage(null);
  }, [contactParam]);

  const applyContactThreadCache = useCallback(
    (restaurantUuid: string, threadContactId: string) => {
      const cached = peekContactThreadCache(restaurantUuid, threadContactId);
      if (!cached?.messages.length) return false;
      setMessages(cached.messages);
      setContactName(cached.contactName);
      setThreadAvatarUrl(cached.threadAvatarUrl ?? null);
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
    setThreadAvatarUrl(null);
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
    Boolean(effectiveThreadContactId) &&
    isLinkedContactId(effectiveThreadContactId!);

  const threadLoadSeqRef = useRef(0);
  const pendingContactIdRef = useRef(pendingContactId);
  pendingContactIdRef.current = pendingContactId;
  const contactParamRef = useRef(contactParam);
  contactParamRef.current = contactParam;
  /** Aktuell gewünschter Thread — überlebt stale Closures während async Fetch. */
  const openThreadIdRef = useRef<string | null>(null);

  const displayMessages = useMemo(() => {
    let rows = enrichMessagesWithWahaReactionIds(messages);
    rows = dedupeWhatsappOutboundThreadRows(rows);
    rows = dropOptimisticMatchingAnchors(rows);
    const chatId =
      whatsappThreadChatId ??
      (effectiveThreadContactId &&
      isWahaPseudoContactId(effectiveThreadContactId)
        ? wahaChatIdFromPseudoContactId(effectiveThreadContactId)
        : null);
    if (restaurantId && chatId) {
      rows = ensureWhatsappWahaProxyAttachments(rows, {
        restaurantId,
        chatId,
      });
    }
    if (!effectiveThreadContactId) return rows;
    return rows.filter(
      (m) => conversationThreadKeyFromRow(m) === effectiveThreadContactId,
    );
  }, [
    messages,
    effectiveThreadContactId,
    restaurantId,
    whatsappThreadChatId,
  ]);

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
    () => conversations.filter((c) => c.is_unread && c.unread_count > 0).length,
    [conversations],
  );

  const showListSkeleton = useDeferredSkeleton(
    loadingList && !refreshingInbox && conversations.length === 0,
  );

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

  const inboxSplitLayout = isLgUp || inboxWorkspaceFullscreen;

  const showConversationList =
    isInboxFilterAvailable(inboxFilter) && (!contactParam || inboxSplitLayout);

  const showInboxRefresh =
    (!contactParam || inboxSplitLayout) &&
    (isUnifiedInboxFilter(inboxFilter) ||
      (inboxFilter === "whatsapp" && whatsappConnected) ||
      (inboxFilter === "email" && emailConnected) ||
      (inboxFilter === "facebook" && facebookConnected) ||
      (inboxFilter === "instagram" && instagramConnected));

  // Sofort aus URL — nicht auf connectionsLoading warten (Keep-alive behält sonst alten Chip).
  useLayoutEffect(() => {
    if (!active) return;
    if (!isNachrichtenMessagesPath(pathname)) return;
    const resolved = parseInboxPlatformFilter(platformParam, contactParam);
    setInboxFilter((prev) => (prev === resolved ? prev : resolved));
  }, [active, pathname, platformParam, contactParam]);

  useEffect(() => {
    // Keep-alive: versteckt bleibt gemountet — URL-Sync darf Soft-Nav nicht zurückreißen.
    if (!active) return;
    if (!isNachrichtenMessagesPath(pathname)) return;
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
      navigateNachrichten(
        `/dashboard/kontakte/nachrichten?${params.toString()}`,
      );
    }
  }, [
    active,
    pathname,
    connectionsLoading,
    workspaceReady,
    restaurantId,
    platformParam,
    contactParam,
    isInboxFilterAvailable,
    navigateNachrichten,
    searchParams,
  ]);

  useEffect(() => {
    if (!active) return;
    const next = parseConversationReadFilter(readParam);
    setReadFilter((prev) => (prev === next ? prev : next));
  }, [active, readParam]);

  const selectReadFilter = useCallback(
    (filter: ConversationReadFilter) => {
      setReadFilter(filter);
      const params = new URLSearchParams(searchParams.toString());
      applyConversationReadFilterToSearchParams(params, filter);
      navigateNachrichten(
        `/dashboard/kontakte/nachrichten?${params.toString()}`,
      );
    },
    [navigateNachrichten, searchParams],
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
          // Frischer Cache: kein Force-Refetch — Background-Poll / Realtime reichen.
          if (!isUnifiedInboxCacheFresh(restaurantId)) {
            void loadConversations({ silent: true, force: true });
          }
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
      if (error && activeRef.current) toast.error(error.message);
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
        if (activeRef.current) toast.error(error.message);
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

  const patchConversationReadState = useCallback(
    (contactId: string, isUnread: boolean, unreadCount = 0) => {
      const readPatch = {
        is_unread: isUnread,
        unread_count: unreadCount,
        whatsapp_unread_count: isUnread ? unreadCount : 0,
        email_unread_count: isUnread ? unreadCount : 0,
        unread_hint: isUnread ? ("channel" as const) : null,
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
      patchConversationReadState(conversationKey, false, 0);
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
        patchConversationReadState(conversationKey, true, 1);
        toast.error(contactInboxMarkReadErrorMessage(result.error));
        return;
      }
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

  const loadThread = useCallback(async (opts?: {
    silent?: boolean;
    /** Sofort nach Klick — nicht auf URL/`?contact=` warten. */
    contactId?: string;
  }) => {
    const threadContactId = opts?.contactId ?? contactParam;
    if (!restaurantId || !threadContactId) {
      setMessages([]);
      setWhatsappThreadPhone(null);
      setLoadingThread(false);
      setThreadHasMore(false);
      setThreadOldestCursor(null);
      return;
    }

    const seq = ++threadLoadSeqRef.current;
    const isLinked = isLinkedContactId(threadContactId);

    if (!opts?.silent) {
      setLoadingThread(true);
      setThreadHasMore(false);
      setThreadOldestCursor(null);
    } else {
      const cachedThread = peekContactThreadCache(restaurantId, threadContactId);
      if (!cachedThread?.messages.length) {
        setLoadingThread(true);
      }
    }
    if (!isWahaPseudoContactId(threadContactId)) {
      setWhatsappThreadPhone(null);
    }
    if (!isLinked) {
      setWhatsappThreadChatId(null);
    }

    const convPreview = conversationsRef.current.find(
      (c) => c.contact_id === threadContactId,
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
        contactId: threadContactId,
        limit: pageLimit,
      });

    if (seq !== threadLoadSeqRef.current) return;
    // Refs statt Closure: openConversation startet den Fetch oft noch mit altem
    // contactParam; pending wird beim URL-Sync genullt — sonst verwerfen wir
    // die Antwort und der Chat bleibt leer / ewig am Laden.
    const stillOpen =
      openThreadIdRef.current === threadContactId ||
      contactParamRef.current === threadContactId ||
      pendingContactIdRef.current === threadContactId;
    if (!stillOpen) {
      setLoadingThread(false);
      return;
    }

    const applyContactMeta = (meta: NonNullable<typeof contact>) => {
      setContactName((prev) =>
        pickContactThreadTitle(
          meta.name,
          listTitle,
          convPreview?.contact_name,
          prev,
        ),
      );
      setThreadAvatarUrl(meta.avatarUrl ?? null);
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
      if (!opts?.silent && activeRef.current) {
        toast.error(toastMsg);
        setMessages([]);
      }
      setLoadingThread(false);
      return;
    }

    if (contact) {
      applyContactMeta(contact);
    } else if (isMetaPseudoContactId(threadContactId)) {
      const metaPlatform = metaPlatformFromPseudoContactId(threadContactId);
      setContactName(
        convPreview?.contact_name ??
          (metaPlatform ? CONTACT_MESSAGE_PLATFORM_LABELS[metaPlatform] : "Chat"),
      );
      setHasPhone(false);
      setHasEmail(false);
    } else if (isEmailPseudoContactId(threadContactId)) {
      setContactName(
        pickContactThreadTitle(convPreview?.contact_name, listTitle, "E-Mail"),
      );
      setHasPhone(false);
      setHasEmail(true);
    } else if (isWahaPseudoContactId(threadContactId)) {
      setContactName(
        pickContactThreadTitle(
          wahaConversationDisplayName({
            contact_id: threadContactId,
            contact_name: convPreview?.contact_name ?? "WhatsApp",
          }),
          listTitle,
          "WhatsApp",
        ),
      );
      setHasPhone(true);
      setHasEmail(false);
      const pseudoChatId = wahaChatIdFromPseudoContactId(threadContactId);
      if (pseudoChatId) setWhatsappThreadChatId(pseudoChatId);
    }

    const resolvedName = pickContactThreadTitle(
      contact?.name,
      listTitle,
      convPreview?.contact_name,
      contactNameRef.current,
    );

    setMessages((prev) => {
      let next = mergeLoadedThreadWithOptimistic(data, prev);
      next = dropOptimisticMatchingAnchors(next);
      if (contactThreadRowsEqual(prev, next)) return prev;
      setContactThreadCache(restaurantId, threadContactId, {
        messages: next,
        contactName: resolvedName,
        threadAvatarUrl: contact?.avatarUrl ?? null,
        hasPhone: contact?.hasPhone ?? false,
        hasEmail: contact?.hasEmail ?? false,
        hasFacebookId: contact?.hasFacebookId ?? false,
        hasInstagramId: contact?.hasInstagramId ?? false,
        whatsappThreadChatId:
          contact?.whatsappThreadChatId ?? whatsappThreadChatIdRef.current,
      });
      return next;
    });

    setThreadHasMore(hasMore);
    setThreadOldestCursor(oldestCursor);
    setLoadingThread(false);

    if (
      isWahaPseudoContactId(threadContactId) ||
      (isLinked && whatsappConnected)
    ) {
      void resolveWhatsAppThreadPhoneSubtitle({
        restaurantId,
        contactId: threadContactId,
        defaultCountryIso2,
        conversationDisplayName: resolvedName,
        contact: null,
        fetchResolvedPhone: fetchWahaResolvedPhoneClient,
      }).then((phone) => {
        if (seq !== threadLoadSeqRef.current) return;
        setWhatsappThreadPhone(phone);
      });
    }

    void markConversationRead(threadContactId);
  }, [
    restaurantId,
    contactParam,
    whatsappConnected,
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

  const patchThreadCache = useCallback(
    (next: ContactMessageRow[]) => {
      if (!restaurantId || !contactParam) return;
      setContactThreadCache(restaurantId, contactParam, {
        messages: next,
        contactName: contactNameRef.current,
        threadAvatarUrl,
        hasPhone,
        hasEmail,
        hasFacebookId,
        hasInstagramId,
        whatsappThreadChatId: whatsappThreadChatIdRef.current,
      });
    },
    [
      restaurantId,
      contactParam,
      threadAvatarUrl,
      hasPhone,
      hasEmail,
      hasFacebookId,
      hasInstagramId,
    ],
  );

  const applyRealtimeThreadInsert = useCallback(
    (row: ContactMessageRow) => {
      setMessages((prev) => {
        const enriched = enrichMessagesWithWahaReactionIds([row])[0]!;
        if (prev.some((m) => m.id === enriched.id)) return prev;
        if (
          enriched.waha_message_id &&
          prev.some((m) => m.waha_message_id === enriched.waha_message_id)
        ) {
          return prev;
        }
        let next = dedupeContactMessagesById([...prev, enriched]);
        if (enriched.external_source_id?.startsWith("client:")) {
          next = next.filter(
            (m) =>
              !(
                isOptimisticContactMessage(m) &&
                m.external_source_id === enriched.external_source_id
              ),
          );
        }
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
        const enriched = enrichMessagesWithWahaReactionIds([row])[0]!;

        let idx = prev.findIndex((m) => m.id === enriched.id);
        if (idx === -1 && enriched.waha_message_id) {
          idx = prev.findIndex(
            (m) =>
              m.waha_message_id === enriched.waha_message_id ||
              m.external_source_id === enriched.external_source_id,
          );
        }
        if (idx === -1 && enriched.external_source_id?.startsWith("waha:")) {
          idx = prev.findIndex(
            (m) =>
              isOptimisticContactMessage(m) &&
              m.platform === "whatsapp" &&
              m.direction === "outbound" &&
              m.body.trim() === enriched.body.trim(),
          );
        }
        if (idx === -1) return prev;

        const next = [...prev];
        next[idx] = {
          ...next[idx]!,
          ...enriched,
          attachments: next[idx]!.attachments ?? enriched.attachments,
        };
        if (contactThreadRowsEqual(prev, next)) return prev;
        patchThreadCache(next);
        return next;
      });
    },
    [patchThreadCache],
  );

  useContactThreadRealtime(overlayThreadId, {
    onInsert: applyRealtimeThreadInsert,
    onUpdate: applyRealtimeThreadUpdate,
  }, { enabled: active });

  useEffect(() => {
    // Cache-Events auch versteckt — nur setState, hält Inbox warm.
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
    if (!active || !restaurantId) return;

    const onMessagesRefresh = () => {
      if (contactParam) return;
      if (listRefreshDebounceRef.current) {
        clearTimeout(listRefreshDebounceRef.current);
      }
      listRefreshDebounceRef.current = setTimeout(() => {
        listRefreshDebounceRef.current = null;
        void loadConversations({ silent: true, force: true });
      }, LIST_SILENT_REFRESH_DEBOUNCE_MS);
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
      if (listRefreshDebounceRef.current) {
        clearTimeout(listRefreshDebounceRef.current);
        listRefreshDebounceRef.current = null;
      }
    };
  }, [
    active,
    restaurantId,
    contactParam,
    loadConversations,
  ]);

  useEffect(() => {
    if (!pendingContactId) return;
    if (contactParam === pendingContactId) {
      setPendingContactId(null);
    }
  }, [contactParam, pendingContactId]);

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
    if (applyContactThreadCache(restaurantId, contactParam)) return;
    // openConversation hat den Thread schon vorbereitet — nicht nochmal leeren.
    if (pendingContactId === contactParam) return;
    resetThreadForLoad();
  }, [
    applyContactThreadCache,
    contactParam,
    pendingContactId,
    resetThreadForLoad,
    restaurantId,
  ]);

  useEffect(() => {
    // Fremde Modul-URLs nicht als Inbox-Params interpretieren (Keep-alive).
    if (!active) return;
    if (!isNachrichtenMessagesPath(pathname)) return;
    if (!restaurantId) return;

    if (!contactParam) {
      if (!pendingContactId) {
        openThreadIdRef.current = null;
      }
      if (connectionsLoading) return;
      const hasInboxCache = Boolean(peekUnifiedInboxCache(restaurantId)?.length);
      void loadConversations(hasInboxCache ? { silent: true } : undefined);
      return;
    }

    openThreadIdRef.current = contactParam;

    // Klick-Pfad lädt bereits via openConversation — nur stiller Refresh nach URL-Sync.
    if (pendingContactId === contactParam) {
      const cached = peekContactThreadCache(restaurantId, contactParam);
      if (cached?.messages.length) {
        void loadThread({ silent: true });
      }
      return;
    }

    if (connectionsLoading) return;
    const cached = peekContactThreadCache(restaurantId, contactParam);
    void loadThread({
      silent: Boolean(cached && cached.messages.length > 0),
    });
  }, [
    active,
    pathname,
    contactParam,
    pendingContactId,
    connectionsLoading,
    restaurantId,
    loadThread,
    loadConversations,
  ]);

  const selectInboxFilter = (filter: InboxPlatformFilter) => {
    if (!isInboxFilterAvailable(filter)) return;
    setInboxFilter(filter);
    openThreadIdRef.current = null;
    setPendingContactId(null);
    const params = new URLSearchParams(searchParams.toString());
    params.set("platform", filter);
    params.delete("contact");
    applyConversationReadFilterToSearchParams(params, readFilter);
    navigateNachrichten(
      `/dashboard/kontakte/nachrichten?${params.toString()}`,
    );
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
      setReservationCreateFor(null);
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
      navigateNachrichten(
        `/dashboard/kontakte/nachrichten?${params.toString()}`,
      );
    },
    [restaurantId, navigateNachrichten],
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
              navigateNachrichten(
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
      navigateNachrichten,
      restaurantId,
    ],
  );

  const openConversation = (contactId: string) => {
    const cached =
      restaurantId && peekContactThreadCache(restaurantId, contactId);
    const preview = conversationsRef.current.find(
      (c) => c.contact_id === contactId,
    );
    const hasCache = Boolean(cached && cached.messages.length > 0);
    // Sofort Pane + Titel — nicht auf Soft-Nav/`?contact=` warten.
    openThreadIdRef.current = contactId;
    setPendingContactId(contactId);
    setClosingThreadId(null);
    setThreadOverlayOpen(true);

    if (hasCache && cached) {
      setMessages(cached.messages);
      setContactName(cached.contactName);
      setThreadAvatarUrl(cached.threadAvatarUrl ?? null);
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
      const previewTitle = pickContactThreadTitle(
        preview?.contact_name,
        wahaThreadTitleFromPreview(preview),
      );
      if (previewTitle !== "Kontakt") setContactName(previewTitle);
      setMessages([]);
      setWhatsappThreadPhone(null);
      setWhatsappThreadChatId(null);
      setLoadingThread(true);
    }

    // Fetch sofort (parallel zur URL) — kein Warten auf connectionsLoading/Soft-Nav.
    if (restaurantId) {
      void loadThread({ contactId, silent: hasCache });
    }

    const params = new URLSearchParams(searchParams.toString());
    if (!params.get("platform")) {
      params.set("platform", INBOX_FILTER_ALL);
    }
    params.set("contact", contactId);
    // Desktop-Split: replace (weniger Soft-Nav-Latenz); Mobil: push für Zurück.
    navigateNachrichten(
      `/dashboard/kontakte/nachrichten?${params.toString()}`,
      isLgUp ? "replace" : "push",
    );
  };

  const prefetchConversationThread = useCallback(
    (contactId: string) => {
      if (!restaurantId || !contactId) return;
      if (peekContactThreadCache(restaurantId, contactId)?.messages.length) {
        return;
      }
      void fetchContactThreadPageClient({
        restaurantId,
        contactId,
        limit: CONTACT_THREAD_PAGE_SIZE,
      }).then(({ data, contact, error }) => {
        if (error || !data.length) return;
        setContactThreadCache(restaurantId, contactId, {
          messages: data,
          contactName: contact?.name ?? "Kontakt",
          threadAvatarUrl: contact?.avatarUrl ?? null,
          hasPhone: contact?.hasPhone ?? false,
          hasEmail: contact?.hasEmail ?? false,
          hasFacebookId: contact?.hasFacebookId ?? false,
          hasInstagramId: contact?.hasInstagramId ?? false,
          whatsappThreadChatId: contact?.whatsappThreadChatId ?? null,
        });
      });
    },
    [restaurantId],
  );

  const prefetchConversationThreadRef = useRef(prefetchConversationThread);
  prefetchConversationThreadRef.current = prefetchConversationThread;

  useEffect(() => {
    if (!active || !restaurantId || contactParam) return;
    if (!isUnifiedInboxFilter(inboxFilter)) return;
    if (conversations.length === 0) return;

    const warmTopThreads = () => {
      for (const row of conversations.slice(0, 6)) {
        prefetchConversationThreadRef.current(row.contact_id);
      }
    };

    if (typeof requestIdleCallback !== "undefined") {
      const id = requestIdleCallback(warmTopThreads, { timeout: 1_500 });
      return () => cancelIdleCallback(id);
    }
    const timer = window.setTimeout(warmTopThreads, 200);
    return () => window.clearTimeout(timer);
  }, [active, restaurantId, contactParam, inboxFilter, conversations]);

  const backToList = useCallback(() => {
    setThreadOverlayOpen(false);
    setPendingContactId(null);
    openThreadIdRef.current = null;
    if (contactParam) {
      setClosingThreadId(contactParam);
      const params = new URLSearchParams();
      params.set("platform", inboxFilter);
      applyConversationReadFilterToSearchParams(params, readFilter);
      navigateNachrichten(
        `/dashboard/kontakte/nachrichten?${params.toString()}`,
      );
    }
    window.setTimeout(() => {
      setClosingThreadId(null);
    }, CONTACT_INBOX_THREAD_OVERLAY_MS);
  }, [contactParam, inboxFilter, readFilter, navigateNachrichten]);

  const resolveChatGuestPrefill = useCallback(async () => {
    const threadId = overlayThreadId;
    if (!threadId || !restaurantId) {
      return buildChatGuestPrefill({ displayName: contactName });
    }

    if (isLinkedContactId(threadId)) {
      const { data } = await fetchContactById({
        restaurantId,
        contactId: threadId,
      });
      if (data) {
        return buildChatGuestPrefill({
          displayName: contactThreadDisplayName(data) || contactName,
          phone: primaryPhone(data),
          email: primaryEmail(data),
        });
      }
    }

    const phone =
      whatsappHeaderSubtitle?.trim() ||
      whatsappThreadPhone?.trim() ||
      null;
    const email = isEmailPseudoContactId(threadId)
      ? emailAddressFromPseudoContactId(threadId)
      : null;

    return buildChatGuestPrefill({
      displayName: contactName,
      phone,
      email,
    });
  }, [
    overlayThreadId,
    restaurantId,
    contactName,
    whatsappHeaderSubtitle,
    whatsappThreadPhone,
  ]);

  const openReservationFromChat = useCallback(() => {
    if (!restaurantId || !overlayThreadId) return;
    void (async () => {
      const guest = await resolveChatGuestPrefill();
      const linked = isLinkedContactId(overlayThreadId);
      const hints = reservationHintsFromLastGuestMessage(messages);
      const hintDay = hints.dateYmd ? localDateFromYmd(hints.dateYmd) : null;
      setReservationForDrawer(null);
      setReservationCreateFor({
        restaurantId,
        day: startOfLocalDay(hintDay ?? new Date()),
        ...(hints.timeHm ? { initialTimeHm: hints.timeHm } : {}),
        ...(hints.partySize != null
          ? { initialPartySize: hints.partySize }
          : {}),
        initialContactId: linked ? overlayThreadId : undefined,
        initialGuestFirstName: linked ? undefined : guest.firstName || undefined,
        initialGuestLastName: linked ? undefined : guest.lastName || undefined,
        initialGuestPhone: linked ? undefined : guest.phone,
        initialGuestEmail: linked ? undefined : guest.email,
      });
      setReservationDrawerOpen(true);
    })();
  }, [restaurantId, overlayThreadId, resolveChatGuestPrefill, messages]);

  const openReviewInviteFromChat = useCallback(() => {
    void (async () => {
      const guest = await resolveChatGuestPrefill();
      const name = [guest.firstName, guest.lastName].filter(Boolean).join(" ");
      setReviewInviteGuest({
        firstName: name || undefined,
        email: guest.email || undefined,
        phone: guest.phone,
      });
      setReviewInviteOpen(true);
    })();
  }, [resolveChatGuestPrefill]);

  const canCreateContactFromThread =
    overlayThreadId != null && isInboxPseudoContactId(overlayThreadId);
  const canAssignStaffFromThread =
    canUpdateStaff &&
    overlayThreadId != null &&
    (isWahaPseudoContactId(overlayThreadId) ||
      isEmailPseudoContactId(overlayThreadId));

  const openAssignStaffFromChat = useCallback(() => {
    void (async () => {
      const guest = await resolveChatGuestPrefill();
      if (overlayThreadId && isEmailPseudoContactId(overlayThreadId)) {
        const email = guest.email?.trim();
        if (!email) {
          toast.warning("Keine E-Mail in diesem Chat.");
          return;
        }
        setAssignStaffKind("email");
        setAssignStaffValue(email);
        setAssignStaffOpen(true);
        return;
      }
      const phone = guest.phone?.trim();
      if (!phone) {
        toast.warning("Keine Telefonnummer in diesem Chat.");
        return;
      }
      setAssignStaffKind("phone");
      setAssignStaffValue(phone);
      setAssignStaffOpen(true);
    })();
  }, [overlayThreadId, resolveChatGuestPrefill]);

  const assignIdentityToStaff = useCallback(
    async (staffId: string, staffLabel: string) => {
      const value = assignStaffValue?.trim();
      if (!value) return;
      setAssigningStaff(true);
      try {
        const ok = await updateStaff(
          staffId,
          assignStaffKind === "email" ? { email: value } : { phone: value },
        );
        if (!ok) {
          toast.error(
            assignStaffKind === "email"
              ? "E-Mail konnte nicht zugeordnet werden."
              : "Nummer konnte nicht zugeordnet werden.",
          );
          return;
        }
        dispatchStaffDataRefresh();
        toast.success(`${value} ist ${staffLabel} zugeordnet.`);
        setAssignStaffOpen(false);
        setAssignStaffValue(null);
      } finally {
        setAssigningStaff(false);
      }
    },
    [assignStaffKind, assignStaffValue],
  );

  /** Overlay-WhatsApp sofort im offenen Thread — ohne loadThread-Flackern. */
  const appendOverlayWhatsappOptimistic = useCallback(
    (params: { clientSendId: string; messageBody: string }) => {
      if (!restaurantId || !overlayThreadId) return;
      const optimistic = createOptimisticOutboundWhatsappMessage({
        restaurantId,
        contactId: overlayThreadId,
        body: params.messageBody,
        clientId: params.clientSendId,
      });
      setMessages((prev) => {
        const next = appendOptimisticMessage(prev, optimistic);
        patchThreadCache(next);
        return next;
      });
    },
    [restaurantId, overlayThreadId, patchThreadCache],
  );

  const confirmOverlayWhatsappOptimistic = useCallback(
    (params: {
      clientSendId: string;
      messageId?: string;
      wahaMessageId?: string | null;
    }) => {
      const optimisticId = `${OPTIMISTIC_MESSAGE_ID_PREFIX}${params.clientSendId}`;
      setMessages((prev) => {
        const next = confirmOptimisticWhatsappMessage(prev, {
          optimisticId,
          messageId: params.messageId,
          wahaMessageId: params.wahaMessageId,
          deliveryStatus: "sent",
        });
        if (!contactThreadRowsEqual(prev, next)) {
          patchThreadCache(next);
        }
        return next;
      });
      void loadConversations({ silent: true });
    },
    [patchThreadCache, loadConversations],
  );

  const failOverlayWhatsappOptimistic = useCallback(
    (clientSendId: string) => {
      const optimisticId = `${OPTIMISTIC_MESSAGE_ID_PREFIX}${clientSendId}`;
      setMessages((prev) => {
        const next = removeOptimisticMessage(prev, optimisticId);
        patchThreadCache(next);
        return next;
      });
    },
    [patchThreadCache],
  );

  const handleReservationWhatsappDispatched = useCallback(
    (payload: ReservationWhatsappDispatchedPayload) => {
      if (!restaurantId || !overlayThreadId || !payload.messageBody.trim()) {
        return;
      }
      const clientSendId = crypto.randomUUID();
      appendOverlayWhatsappOptimistic({
        clientSendId,
        messageBody: payload.messageBody,
      });
      confirmOverlayWhatsappOptimistic({
        clientSendId,
        messageId: payload.messageId,
        wahaMessageId: payload.wahaMessageId,
      });
    },
    [
      restaurantId,
      overlayThreadId,
      appendOverlayWhatsappOptimistic,
      confirmOverlayWhatsappOptimistic,
    ],
  );

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

  const threadHasWhatsappMessages = useMemo(
    () => displayMessages.some((m) => messageDisplayPlatform(m) === "whatsapp"),
    [displayMessages],
  );

  const wahaReactionsConfig = useMemo((): ContactMessageWahaReactionsConfig | undefined => {
    if (!restaurantId || !whatsappThreadChatId) return undefined;
    const showWaha =
      isWahaPseudoContactId(overlayThreadId ?? "") ||
      (linkedThread && threadHasWhatsappMessages);
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
    threadHasWhatsappMessages,
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

  const applyWhatsappSendSuccess = useCallback(
    (
      optimisticWhatsapp: ContactMessageRow | null,
      result: SendContactMessageApiResult | null,
    ) => {
      if (!optimisticWhatsapp || !result?.ok) return;

      if (result.wahaMessageId || result.messageId) {
        setMessages((prev) => {
          const next = confirmOptimisticWhatsappMessage(prev, {
            optimisticId: optimisticWhatsapp.id,
            wahaMessageId: result.wahaMessageId,
            messageId: result.messageId,
          });
          if (!contactThreadRowsEqual(prev, next)) {
            patchThreadCache(next);
          }
          return next;
        });
        return;
      }

      /** Medien ohne WAHA-ID in der API-Response: Realtime INSERT/UPDATE übernimmt. */
    },
    [patchThreadCache],
  );

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
      let whatsappClientSendId: string | undefined;
      if ((sendWhatsapp || voiceNote) && contactParam) {
        whatsappClientSendId = crypto.randomUUID();
        optimisticWhatsapp = createOptimisticOutboundWhatsappMessage({
          restaurantId,
          contactId: contactParam,
          body,
          files,
          voiceNote,
          voicePreviewUrl: voiceNote
            ? URL.createObjectURL(voiceNote)
            : undefined,
          clientId: whatsappClientSendId,
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
        clientSendId: whatsappClientSendId,
        files,
        voiceNote,
      });
      setSending(false);
      if (optimisticWhatsapp && !result?.ok) {
        setMessages((prev) =>
          removeOptimisticMessage(prev, optimisticWhatsapp!.id),
        );
      }
      toastContactSendResult(result, "Nachricht gesendet.");
      if (result?.ok) {
        if (sendWhatsapp || (voiceNote && channels.includes("whatsapp"))) {
          applyWhatsappSendSuccess(optimisticWhatsapp, result);
        } else {
          void loadThread({ silent: true });
        }
        void loadConversations({ silent: true });
      }
      return;
    }

    if (isWahaPseudoContactId(contactParam)) {
      const whatsappClientSendId = crypto.randomUUID();
      const optimisticWhatsapp = createOptimisticOutboundWhatsappMessage({
        restaurantId,
        contactId: contactParam,
        body,
        files,
        voiceNote,
        voicePreviewUrl: voiceNote ? URL.createObjectURL(voiceNote) : undefined,
        clientId: whatsappClientSendId,
      });
      setMessages((prev) => appendOptimisticMessage(prev, optimisticWhatsapp));

      const result = await triggerWahaSendMessage({
        restaurantId,
        wahaContactId: contactParam,
        messageBody: body,
        clientSendId: whatsappClientSendId,
        files,
        voiceNote,
      });
      setSending(false);
      if (!result?.ok) {
        setMessages((prev) =>
          removeOptimisticMessage(prev, optimisticWhatsapp.id),
        );
      }
      toastContactSendResult(result, "WhatsApp-Nachricht gesendet.");
      if (result?.ok) {
        applyWhatsappSendSuccess(optimisticWhatsapp, result);
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
      toastContactSendResult(result, "E-Mail gesendet.");
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
      toastContactSendResult(
        result,
        metaThreadPlatform === "instagram"
          ? "Instagram-Nachricht gesendet."
          : "Messenger-Nachricht gesendet.",
      );
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

  if (!permissionsLoading && !canRead) {
    return <ModuleAccessDenied label="Nachrichten" />;
  }


  const threadId = overlayThreadId;
  const threadAriaLabel = contactName ? `Chat mit ${contactName}` : "Chat";
  const threadHeader = (
<div className="flex items-center gap-2 px-4 py-3 sm:px-5">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={cn("shrink-0", inboxSplitLayout ? "hidden" : "lg:hidden")}
                aria-label="Zurück zur Liste"
                onClick={backToList}
              >
                <ArrowLeft className="size-4" />
              </Button>
              <ContactThreadHeaderAvatar
                avatarUrl={threadAvatarUrl}
                displayName={contactName || "Kontakt"}
              />
              <div className="min-w-0 flex-1">
                {canOpenLinkedContact(threadId!) ? (
                  <button
                    type="button"
                    className="max-w-full truncate text-left text-base font-semibold tracking-tight hover:underline"
                    onClick={() => openLinkedContact(threadId!)}
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
                ) : isWahaPseudoContactId(threadId!) ? (
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
                ) : isEmailPseudoContactId(threadId!) ? (
                  <p className="text-xs text-muted-foreground">E-Mail</p>
                ) : isMetaPseudoContactId(threadId!) ? (
                  <p className="text-xs text-muted-foreground">
                    {CONTACT_MESSAGE_PLATFORM_LABELS[
                      metaPlatformFromPseudoContactId(threadId!) ?? "facebook"
                    ]}
                  </p>
                ) : null}
              </div>
              {canOpenLinkedContact(threadId!) ? (
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  className="shrink-0 rounded-full"
                  aria-label="Kontakt öffnen"
                  onClick={() => openLinkedContact(threadId!)}
                >
                  <UserRound className="size-4" />
                </Button>
              ) : null}
              <ContactInboxThreadHeaderMenu
                canCreateContact={canCreateContactFromThread}
                canCreateReservation={canCreateReservation}
                canSendReviewLink={canCreateReviewInvite}
                canAssignStaff={canAssignStaffFromThread}
                assignStaffKind={
                  threadId! != null &&
                  isEmailPseudoContactId(threadId!)
                    ? "email"
                    : "phone"
                }
                onCreateContact={() =>
                  openCreateContactFromPseudo(
                    threadId!,
                    contactName ||
                      (isEmailPseudoContactId(threadId!)
                        ? "E-Mail"
                        : "WhatsApp"),
                  )
                }
                onReservation={openReservationFromChat}
                onReviewInvite={openReviewInviteFromChat}
                onAssignStaff={openAssignStaffFromChat}
              />
            </div>
  );
  const threadFooter = (
showReplyComposer ? (
              <div className="min-w-0 overflow-visible px-4 py-2 sm:px-5 sm:py-3">
                <ContactMessageComposer
                  disabled={loadingThread || (linkedThread && !canReply)}
                  sending={sending}
                  hasPhone={
                    isWahaPseudoContactId(threadId!)
                      ? true
                      : effectiveHasPhone
                  }
                  hasEmail={
                    isEmailPseudoContactId(threadId!)
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
                      : isWahaPseudoContactId(threadId!)
                        ? "whatsapp-only"
                      : isEmailPseudoContactId(threadId!)
                          ? "email-only"
                          : isMetaPseudoContactId(threadId!)
                            ? "meta-only"
                            : "unified"
                  }
                  stickyFooter
                  placeholder={
                    isWahaPseudoContactId(threadId!)
                      ? "WhatsApp-Nachricht …"
                      : isEmailPseudoContactId(threadId!)
                        ? "E-Mail schreiben …"
                        : isMetaPseudoContactId(threadId!) && metaThreadPlatform
                          ? `${CONTACT_MESSAGE_PLATFORM_LABELS[metaThreadPlatform]}-Nachricht …`
                          : "Antwort schreiben …"
                  }
                  whatsappTyping={
                    restaurantId &&
                    whatsappThreadChatId &&
                    !editingWahaMessage &&
                    (linkedThread
                      ? defaultReplySend.whatsapp
                      : isWahaPseudoContactId(threadId!))
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
  );
  const threadViewport = (
<div className="flex h-full min-h-0 flex-col px-4 pt-4 sm:px-5 sm:pt-5">
            <ContactMessageChatViewport
              messages={displayMessages}
              loading={loadingThread}
              threadKey={threadId!}
              className="h-full min-h-0 flex-1"
              hasMoreOlder={threadHasMore}
              loadingOlder={loadingOlderMessages}
              onLoadOlder={() => void loadOlderThreadMessages()}
              onReservationOpen={(id) => void openReservationFromMessage(id)}
              wahaReactions={wahaReactionsConfig}
              metaReactions={metaReactionsConfig}
              canViewProtocol={canViewMessageProtocol}
              onOpenProtocol={setMessageProtocolId}
            />
          </div>
  );

  const inboxSplitPane = (
      <div
        className={cn(
          "flex min-w-0 flex-col gap-4",
          inboxSplitLayout
            ? "min-h-0 flex-1 flex-row gap-0 overflow-hidden rounded-xl border border-border/50 bg-card shadow-card"
            : "lg:min-h-0 lg:flex-1 lg:flex-row lg:gap-0 lg:overflow-hidden lg:rounded-xl lg:border lg:border-border/50 lg:bg-card lg:shadow-card",
        )}
      >
      {showConversationList ? (
        <div
          className={cn(
            "flex min-h-0 min-w-0 flex-col",
            inboxSplitLayout
              ? "h-full w-[min(100%,24rem)] shrink-0 overflow-hidden border-r border-border/50"
              : "lg:h-full lg:w-[min(100%,24rem)] lg:shrink-0 lg:overflow-hidden lg:border-r lg:border-border/50",
          )}
        >
        <Card
          className={cn(
            "flex w-full min-h-0 min-w-0 flex-col border-border/50 shadow-card",
            inboxSplitLayout
              ? "h-full rounded-none border-0 shadow-none"
              : "lg:h-full lg:rounded-none lg:border-0 lg:shadow-none",
          )}
        >
            <div className="shrink-0 space-y-3 border-b border-border/50 px-4 py-3 sm:px-6">
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
          <CardContent
            className={cn(
              "min-h-0 p-0",
              inboxSplitLayout
                ? "flex-1 overflow-y-auto"
                : "lg:flex-1 lg:overflow-y-auto",
            )}
          >
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
                  const unreadHint = c.unread_hint ?? null;
                  const hintLabel = inboxUnreadHintLabel(unreadHint);
                  const statusChip = inboxUnreadStatusChipLabel(unread, unreadHint);
                  const nameClassName = inboxUnreadNameClassName(unread, unreadHint);
                  return (
                  <li
                    key={c.contact_id}
                    className={cn(
                      contactInboxConversationRowClassName,
                      inboxUnreadRowBackgroundClassName(unread, unreadHint),
                      effectiveThreadContactId === c.contact_id &&
                        "bg-accent/10 hover:bg-accent/15",
                    )}
                    onPointerDown={(e) => {
                      if (e.button !== 0) return;
                      prefetchConversationThread(c.contact_id);
                    }}
                    onPointerEnter={() =>
                      prefetchConversationThread(c.contact_id)
                    }
                  >
                    {unread ? (
                      <span
                        className={inboxUnreadRowStripeClassName(unread, unreadHint)}
                        aria-hidden
                      />
                    ) : null}
                    <button
                      type="button"
                      className={contactInboxConversationRowOpenButtonClassName}
                      aria-label={
                        statusChip
                          ? `Chat mit ${listName} öffnen, ${statusChip}`
                          : `Chat mit ${listName} öffnen`
                      }
                      onClick={() => openConversation(c.contact_id)}
                    />
                    <div className="relative z-10 shrink-0 pointer-events-none">
                      <ProfileRoundAvatar
                        src={inboxConversationAvatarUrl(c)}
                        initials={inboxConversationAvatarInitials(listName, c)}
                        size="md"
                        className={inboxUnreadAvatarClassName(unread, unreadHint)}
                      />
                      {unread ? (
                        <span
                          className={cn(
                            "absolute -right-0.5 -top-0.5 size-2.5 rounded-full",
                            inboxUnreadDotClassName(unreadHint),
                          )}
                          aria-hidden
                        />
                      ) : null}
                    </div>
                    <div className="relative z-10 min-w-0 flex-1 pointer-events-none">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex min-w-0 flex-1 items-center gap-1.5">
                        {canOpenLinkedContact(c.contact_id) ? (
                          <button
                            type="button"
                            className={cn(
                              "pointer-events-auto min-w-0 truncate text-left hover:underline",
                              nameClassName,
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
                              nameClassName,
                            )}
                          >
                            {listName}
                          </span>
                        )}
                        {statusChip ? (
                          <span
                            className={inboxUnreadStatusChipClassName(unreadHint)}
                            title={hintLabel ?? undefined}
                          >
                            {statusChip}
                          </span>
                        ) : null}
                        </div>
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
                            <span
                              className={inboxUnreadCountBadgeClassName(unreadHint)}
                              title={hintLabel ?? undefined}
                            >
                              {c.unread_count > 99 ? "99+" : c.unread_count}
                            </span>
                          ) : null}
                          <span
                            className={cn(
                              "text-[10px] tabular-nums",
                              unread && unreadHint !== "gwada_only"
                                ? "font-medium text-accent"
                                : unread
                                  ? "font-medium text-muted-foreground"
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
                            unread && unreadHint !== "gwada_only"
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
                        {c.has_reservation_link && c.last_reservation_id ? (
                          <Badge
                            variant="outline"
                            className="pointer-events-auto mt-1.5 h-5 cursor-pointer gap-0.5 px-1.5 text-[10px] font-normal hover:bg-muted/60"
                            render={
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void openReservationFromMessage(
                                    c.last_reservation_id!,
                                  );
                                }}
                              />
                            }
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
        </div>
      ) : null}

      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col overflow-hidden",
          inboxSplitLayout ? "flex" : "hidden lg:flex",
        )}
      >
        {overlayThreadId ? (
          <ContactInboxThreadChrome
            header={threadHeader}
            footer={threadFooter}
            aria-label={threadAriaLabel}
            className="min-h-0 flex-1"
          >
            {threadViewport}
          </ContactInboxThreadChrome>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-1 px-6 text-center">
            <p className="text-sm font-medium text-foreground">
              Chat auswählen
            </p>
            <p className="text-sm text-muted-foreground">
              Konversation links öffnen — Verlauf erscheint hier.
            </p>
          </div>
        )}
      </div>
      </div>
  );

  const renderInboxFilterSection = (showFullscreenToggle: boolean) =>
    (!contactParam || inboxSplitLayout) ? (
        <div className="shrink-0 space-y-3">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
      <ContactInboxFilterChips
        filter={inboxFilter}
        onFilterChange={selectInboxFilter}
        isPlatformAvailable={isInboxFilterAvailable}
        disabled={connectionsLoading}
      />
        </div>
        {showFullscreenToggle ? (
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="outline"
                size="icon"
                className={moduleTableFullscreenToggleButtonClassName}
                onClick={() => setInboxWorkspaceFullscreen(true)}
                aria-label="Nachrichten im Vollbild anzeigen"
              />
            }
          >
            <Maximize2 className="size-4" />
          </TooltipTrigger>
          <TooltipContent side="top">Vollbild</TooltipContent>
        </Tooltip>
        ) : null}
      </div>

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
        </div>
      ) : null;

  return (
    <>
      {!inboxWorkspaceFullscreen ? (
    <div
      className={cn(
        "flex w-full min-w-0 flex-col gap-4 pt-2",
        // Desktop: Viewport-Höhe — Liste und Chat scrollen getrennt, Chat bleibt sichtbar.
        "lg:h-[calc(100dvh-var(--app-chrome-header-h)-var(--app-module-chip-sticky-h,3rem)-2.5rem)] lg:min-h-0 lg:gap-3 lg:overflow-hidden lg:pt-1",
      )}
    >
      {renderInboxFilterSection(true)}

      {inboxSplitPane}
    </div>
      ) : null}

      <AppFullscreenOverlay
        open={inboxWorkspaceFullscreen}
        onClose={closeInboxWorkspaceFullscreen}
        aria-label="Nachrichten"
        header={
          <div className="flex w-full items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                Nachrichten
              </p>
              <p className="truncate text-sm text-muted-foreground">
                Chatliste und Verlauf im Vollbild
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className={moduleTableFullscreenToggleButtonClassName}
                    onClick={closeInboxWorkspaceFullscreen}
                    aria-label="Vollbild schließen"
                  />
                }
              >
                <Minimize2 className="size-4" />
              </TooltipTrigger>
              <TooltipContent side="top">Vollbild schließen</TooltipContent>
            </Tooltip>
          </div>
        }
      >
        {inboxWorkspaceFullscreen ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden px-4 pb-4 pt-1">
            {renderInboxFilterSection(false)}
            {inboxSplitPane}
          </div>
        ) : null}
      </AppFullscreenOverlay>

      {overlayThreadId && !inboxSplitLayout ? (
        <ContactInboxThreadOverlay
          open={threadOverlayOpen}
          onClose={backToList}
          aria-label={threadAriaLabel}
          header={threadHeader}
          footer={threadFooter}
        >
          {threadViewport}
        </ContactInboxThreadOverlay>
      ) : null}

      <ReservationEditDrawer
        open={reservationDrawerOpen}
        onOpenChange={(open) => {
          setReservationDrawerOpen(open);
          if (!open) {
            setReservationForDrawer(null);
            setReservationCreateFor(null);
          }
        }}
        reservation={reservationForDrawer}
        createFor={reservationCreateFor}
        stackAboveInboxOverlay={
          (threadOverlayOpen && Boolean(overlayThreadId)) ||
          inboxWorkspaceFullscreen
        }
        onWhatsappDispatched={handleReservationWhatsappDispatched}
        onSaved={() => {
          setReservationDrawerOpen(false);
          setReservationForDrawer(null);
          setReservationCreateFor(null);
          if (contactParam) void loadThread({ silent: true });
        }}
      />

      <ReviewInvitationSheet
        open={reviewInviteOpen}
        onOpenChange={(open) => {
          setReviewInviteOpen(open);
          if (!open) setReviewInviteGuest(null);
        }}
        restaurantId={restaurantId}
        restaurantName={profile.name.trim() || "Restaurant"}
        defaultCountryIso2={defaultCountryIso2}
        initialGuest={reviewInviteGuest}
        stackAboveInboxOverlay={
          (threadOverlayOpen && Boolean(overlayThreadId)) ||
          inboxWorkspaceFullscreen
        }
        onWhatsappOutboundStart={({ clientSendId, messageBody }) => {
          appendOverlayWhatsappOptimistic({ clientSendId, messageBody });
        }}
        onWhatsappOutboundSuccess={({
          clientSendId,
          messageId,
          wahaMessageId,
        }) => {
          confirmOverlayWhatsappOptimistic({
            clientSendId,
            messageId,
            wahaMessageId,
          });
        }}
        onWhatsappOutboundFailure={({ clientSendId }) => {
          failOverlayWhatsappOptimistic(clientSendId);
        }}
      />

      <ContactMessageProtocolDrawer
        open={messageProtocolId !== null}
        onOpenChange={(open) => {
          if (!open) setMessageProtocolId(null);
        }}
        restaurantId={restaurantId}
        messageId={messageProtocolId}
      />

      <ContactEditDrawer
        open={contactDrawerOpen}
        stackAboveInboxOverlay={
          (threadOverlayOpen && Boolean(overlayThreadId)) ||
          inboxWorkspaceFullscreen
        }
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
              const pending = pendingInboxLink;
              setPendingInboxLink(null);
              setContactCreateDraft(null);
              const platformParam =
                pending.platform === "email" ? "email" : "all";
              navigateNachrichten(
                `/dashboard/kontakte/nachrichten?platform=${platformParam}&contact=${detail.contactId}`,
              );

              if (pending.platform === "whatsapp") {
                const link = await triggerLinkWahaThreadToContact({
                  restaurantId,
                  wahaContactId: pending.pseudoContactId,
                  contactId: detail.contactId,
                });
                if (link?.ok) {
                  const n = link.imported ?? 0;
                  if (n > 0) {
                    toast.success(
                      `${n} WhatsApp-Nachrichten mit dem Kontakt verknüpft.`,
                    );
                  }
                } else {
                  toast.warning(
                    "Kontakt angelegt, WhatsApp-Verlauf konnte nicht importiert werden.",
                  );
                }
                return;
              }

              if (
                pending.platform === "facebook" ||
                pending.platform === "instagram"
              ) {
                const link = await triggerLinkMetaThreadToContact({
                  restaurantId,
                  metaContactId: pending.pseudoContactId,
                  contactId: detail.contactId,
                });
                const label =
                  pending.platform === "instagram"
                    ? "Instagram"
                    : "Messenger";
                if (link?.ok) {
                  const n = link.imported ?? 0;
                  if (n > 0) {
                    toast.success(
                      `${n} ${label}-Nachrichten mit dem Kontakt verknüpft.`,
                    );
                  }
                } else {
                  toast.warning(
                    `Kontakt angelegt, ${label}-Verlauf konnte nicht importiert werden.`,
                  );
                }
                return;
              }

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

      <InboxThreadAssignStaffSheet
        open={assignStaffOpen}
        onOpenChange={(open) => {
          if (!open) {
            setAssignStaffOpen(false);
            setAssignStaffValue(null);
          }
        }}
        restaurantId={restaurantId}
        kind={assignStaffKind}
        valueDisplay={assignStaffValue ?? ""}
        assigning={assigningStaff}
        stackAboveInboxOverlay={
          (threadOverlayOpen && Boolean(overlayThreadId)) ||
          inboxWorkspaceFullscreen
        }
        onAssign={assignIdentityToStaff}
      />
    </>
  );
}
