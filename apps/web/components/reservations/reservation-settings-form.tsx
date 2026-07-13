"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { WhatsAppGlyph } from "@/components/icons/whatsapp-glyph";
import {
  ReservationNotificationChannelSection,
  reservationEmailSettingsSectionClassName,
  reservationWhatsappSettingsSectionClassName,
  type NotificationKindFieldState,
} from "@/components/reservations/reservation-notification-channel-section";
import { ReviewRequestPlatformsField } from "@/components/reservations/review-request-platforms-field";
import { ReservationPlatformBookingLinks } from "@/components/reservations/reservation-platform-booking-links";
import {
  Card,
  CardContent,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SettingsStickySaveBar,
  settingsAccentSaveButtonClassName,
} from "@/components/settings/settings-sticky-save-bar";
import { usePlatformMessagingFlags } from "@/lib/hooks/use-platform-messaging-flags";
import { useRestaurantChannelConnections } from "@/lib/hooks/use-restaurant-channel-connections";
import { useReviewPlatformConnections } from "@/lib/hooks/use-review-platform-connections";
import {
  defaultReviewRequestIncludes,
  reviewIncludesFromRow,
  type ReviewRequestIncludes,
} from "@/lib/reviews/review-request-settings";
import { validateGuestManageUrlTemplate } from "@/lib/reservations/guest-manage-url";
import {
  BOOKING_TIME_STEP_LABELS,
  BOOKING_TIME_STEP_OPTIONS,
  normalizeBookingTimeStepMinutes,
} from "@/lib/reservations/booking-time-step";
import type { ReservationNotificationKind } from "@/lib/reservations/reservation-notification-message-config";
import {
  fetchReservationSettings,
  reservationSettingsEmailSubjectStored,
  reservationSettingsTemplateStored,
  upsertReservationSettings,
  type RestaurantReservationSettingsRow,
} from "@/lib/supabase/reservation-settings-db";
import { fetchReservationStatuses } from "@/lib/supabase/reservations-db";
import {
  WorkspaceRestaurantMissingMessage,
  WorkspaceRestaurantResolvePlaceholder,
} from "@/components/workspace/workspace-restaurant-placeholder";
import { useWorkspaceRestaurantUuid } from "@/lib/hooks/use-workspace-restaurant-uuid";
import { appSelectTriggerAccentCn } from "@/lib/ui/app-select-trigger-accent";
import { publicSurfaceScopeHint } from "@/lib/ui/public-surface-settings-copy";
import {
  DEFAULT_WHATSAPP_TEMPLATES,
  DEFAULT_EMAIL_SUBJECT_BY_KIND,
  emailSubjectFormValueFromDb,
  emailSubjectFormValueToDb,
  templateFormValueFromDb,
  templateFormValueToDb,
  validateEmailSenderName,
  validateEmailSubject,
  validateWhatsappMessageTemplate,
  type WhatsappMessageKind,
} from "@/lib/whatsapp/reservation-whatsapp-message-config";
import { cn } from "@/lib/utils";
import Link from "next/link";

export { reservationWhatsappSettingsSectionClassName } from "@/components/reservations/reservation-notification-channel-section";

type ChannelFormSlice = {
  received: boolean;
  confirmed: boolean;
  reminder: boolean;
  reminderHours: string;
  thanks: boolean;
  thanksHours: string;
  cancelled: boolean;
  declined: boolean;
  noShow: boolean;
  tmplReceived: string;
  tmplConfirmed: string;
  tmplReminder: string;
  tmplThanks: string;
  tmplCancelled: string;
  tmplDeclined: string;
  tmplNoShow: string;
};

type EmailChannelFormSlice = ChannelFormSlice & {
  subjReceived: string;
  subjConfirmed: string;
  subjReminder: string;
  subjThanks: string;
  subjCancelled: string;
  subjDeclined: string;
  subjNoShow: string;
};

const EMBED_FOOTER_TEXT_MAX = 2000;

type SettingsSnapshot = {
  minutes: string;
  leadTimeHours: string;
  minBeforeCloseMinutes: string;
  bookingTimeStepMinutes: string;
  embedFormFooterText: string;
  guestManageUrl: string;
  emailSenderName: string;
  whatsapp: ChannelFormSlice;
  email: EmailChannelFormSlice;
  whatsappReview: ReviewRequestIncludes;
  emailReview: ReviewRequestIncludes;
  reviewGoogleUrl: string;
  reviewFacebookUrl: string;
  walkInEnabled: boolean;
};

function tmplFromRow(
  data: RestaurantReservationSettingsRow | null | undefined,
  channel: "whatsapp" | "email",
  kind: WhatsappMessageKind,
): string {
  return templateFormValueFromDb(
    reservationSettingsTemplateStored(data, channel, kind),
    kind,
  );
}

function subjFromRow(
  data: RestaurantReservationSettingsRow | null | undefined,
  kind: WhatsappMessageKind,
): string {
  return emailSubjectFormValueFromDb(
    reservationSettingsEmailSubjectStored(data, kind),
    kind,
  );
}

function channelFromRow(
  data: RestaurantReservationSettingsRow | null | undefined,
  channel: "whatsapp" | "email",
): ChannelFormSlice | EmailChannelFormSlice {
  const p = (kind: WhatsappMessageKind) => tmplFromRow(data, channel, kind);
  if (channel === "whatsapp") {
    return {
      received: data?.whatsapp_received_enabled ?? true,
      confirmed: data?.whatsapp_confirmed_enabled ?? true,
      reminder: data?.whatsapp_reminder_enabled ?? true,
      reminderHours: String(data?.whatsapp_reminder_hours_before ?? 24),
      thanks: data?.whatsapp_thanks_enabled ?? true,
      thanksHours: String(data?.whatsapp_thanks_hours_after ?? 2),
      cancelled: data?.whatsapp_cancelled_enabled ?? true,
      declined: data?.whatsapp_declined_enabled ?? true,
      noShow: data?.whatsapp_no_show_enabled ?? true,
      tmplReceived: p("received"),
      tmplConfirmed: p("confirmed"),
      tmplReminder: p("reminder"),
      tmplThanks: p("thanks"),
      tmplCancelled: p("cancelled"),
      tmplDeclined: p("declined"),
      tmplNoShow: p("no_show"),
    };
  }
  const s = (kind: WhatsappMessageKind) => subjFromRow(data, kind);
  return {
    received: data?.email_received_enabled ?? true,
    confirmed: data?.email_confirmed_enabled ?? true,
    reminder: data?.email_reminder_enabled ?? true,
    reminderHours: String(data?.email_reminder_hours_before ?? 24),
    thanks: data?.email_thanks_enabled ?? true,
    thanksHours: String(data?.email_thanks_hours_after ?? 2),
    cancelled: data?.email_cancelled_enabled ?? true,
    declined: data?.email_declined_enabled ?? true,
    noShow: data?.email_no_show_enabled ?? true,
    tmplReceived: p("received"),
    tmplConfirmed: p("confirmed"),
    tmplReminder: p("reminder"),
    tmplThanks: p("thanks"),
    tmplCancelled: p("cancelled"),
    tmplDeclined: p("declined"),
    tmplNoShow: p("no_show"),
    subjReceived: s("received"),
    subjConfirmed: s("confirmed"),
    subjReminder: s("reminder"),
    subjThanks: s("thanks"),
    subjCancelled: s("cancelled"),
    subjDeclined: s("declined"),
    subjNoShow: s("no_show"),
  };
}

function defaultEmailChannelSlice(): EmailChannelFormSlice {
  return {
    ...defaultChannelSlice(),
    subjReceived: DEFAULT_EMAIL_SUBJECT_BY_KIND.received,
    subjConfirmed: DEFAULT_EMAIL_SUBJECT_BY_KIND.confirmed,
    subjReminder: DEFAULT_EMAIL_SUBJECT_BY_KIND.reminder,
    subjThanks: DEFAULT_EMAIL_SUBJECT_BY_KIND.thanks,
    subjCancelled: DEFAULT_EMAIL_SUBJECT_BY_KIND.cancelled,
    subjDeclined: DEFAULT_EMAIL_SUBJECT_BY_KIND.declined,
    subjNoShow: DEFAULT_EMAIL_SUBJECT_BY_KIND.no_show,
  };
}

function channelTemplateForKind(
  slice: ChannelFormSlice,
  kind: WhatsappMessageKind,
): string {
  switch (kind) {
    case "received":
      return slice.tmplReceived;
    case "confirmed":
      return slice.tmplConfirmed;
    case "reminder":
      return slice.tmplReminder;
    case "thanks":
      return slice.tmplThanks;
    case "cancelled":
      return slice.tmplCancelled;
    case "declined":
      return slice.tmplDeclined;
    case "no_show":
      return slice.tmplNoShow;
  }
}

function emailSubjectForKind(
  slice: EmailChannelFormSlice,
  kind: WhatsappMessageKind,
): string {
  switch (kind) {
    case "received":
      return slice.subjReceived;
    case "confirmed":
      return slice.subjConfirmed;
    case "reminder":
      return slice.subjReminder;
    case "thanks":
      return slice.subjThanks;
    case "cancelled":
      return slice.subjCancelled;
    case "declined":
      return slice.subjDeclined;
    case "no_show":
      return slice.subjNoShow;
  }
}

function defaultChannelSlice(): ChannelFormSlice {
  return {
    received: true,
    confirmed: true,
    reminder: true,
    reminderHours: "24",
    thanks: true,
    thanksHours: "2",
    cancelled: true,
    declined: true,
    noShow: true,
    tmplReceived: DEFAULT_WHATSAPP_TEMPLATES.received,
    tmplConfirmed: DEFAULT_WHATSAPP_TEMPLATES.confirmed,
    tmplReminder: DEFAULT_WHATSAPP_TEMPLATES.reminder,
    tmplThanks: DEFAULT_WHATSAPP_TEMPLATES.thanks,
    tmplCancelled: DEFAULT_WHATSAPP_TEMPLATES.cancelled,
    tmplDeclined: DEFAULT_WHATSAPP_TEMPLATES.declined,
    tmplNoShow: DEFAULT_WHATSAPP_TEMPLATES.no_show,
  };
}

function rowToSnapshot(
  data: RestaurantReservationSettingsRow | null | undefined,
): SettingsSnapshot {
  const row = data as Record<string, unknown> | null | undefined;
  return {
    minutes: String(data?.default_dwell_minutes ?? 120),
    leadTimeHours: String(data?.booking_lead_time_hours ?? 2),
    minBeforeCloseMinutes: String(data?.min_minutes_before_closing ?? 60),
    bookingTimeStepMinutes: String(
      normalizeBookingTimeStepMinutes(data?.booking_time_step_minutes),
    ),
    embedFormFooterText: data?.embed_form_footer_text ?? "",
    guestManageUrl: data?.guest_manage_url_template ?? "",
    emailSenderName: data?.email_sender_name?.trim() ?? "",
    whatsapp: channelFromRow(data, "whatsapp") as ChannelFormSlice,
    email: channelFromRow(data, "email") as EmailChannelFormSlice,
    whatsappReview: reviewIncludesFromRow(row, "whatsapp"),
    emailReview: reviewIncludesFromRow(row, "email"),
    reviewGoogleUrl:
      typeof data?.review_google_url === "string" ? data.review_google_url : "",
    reviewFacebookUrl:
      typeof data?.review_facebook_url === "string"
        ? data.review_facebook_url
        : "",
    walkInEnabled: data?.walk_in_enabled === true,
  };
}

function validateEmailSubjects(email: EmailChannelFormSlice): boolean {
  const items: Array<{ name: string; value: string; kind: WhatsappMessageKind }> =
    [
      { name: "E-Mail Eingang", value: email.subjReceived, kind: "received" },
      { name: "E-Mail Bestätigung", value: email.subjConfirmed, kind: "confirmed" },
      { name: "E-Mail Erinnerung", value: email.subjReminder, kind: "reminder" },
      { name: "E-Mail Danke", value: email.subjThanks, kind: "thanks" },
      { name: "E-Mail Storniert", value: email.subjCancelled, kind: "cancelled" },
      { name: "E-Mail Abgelehnt", value: email.subjDeclined, kind: "declined" },
      { name: "E-Mail Nicht erschienen", value: email.subjNoShow, kind: "no_show" },
    ];
  for (const item of items) {
    const err = validateEmailSubject(item.value);
    if (err) {
      toast.error(`${item.name}: ${err}`);
      return false;
    }
  }
  return true;
}

function validateChannelTemplates(
  channel: ChannelFormSlice,
  label: string,
): boolean {
  const items: Array<{ name: string; value: string; kind: WhatsappMessageKind }> =
    [
      { name: `${label} Eingang`, value: channel.tmplReceived, kind: "received" },
      { name: `${label} Bestätigung`, value: channel.tmplConfirmed, kind: "confirmed" },
      { name: `${label} Erinnerung`, value: channel.tmplReminder, kind: "reminder" },
      { name: `${label} Danke`, value: channel.tmplThanks, kind: "thanks" },
      { name: `${label} Storniert`, value: channel.tmplCancelled, kind: "cancelled" },
      { name: `${label} Abgelehnt`, value: channel.tmplDeclined, kind: "declined" },
      { name: `${label} Nicht erschienen`, value: channel.tmplNoShow, kind: "no_show" },
    ];
  for (const item of items) {
    const err = validateWhatsappMessageTemplate(item.value);
    if (err) {
      toast.error(`${item.name}: ${err}`);
      return false;
    }
  }
  return true;
}

function buildFieldsByKind(
  slice: ChannelFormSlice,
  setters: {
    setReceived: (v: boolean) => void;
    setConfirmed: (v: boolean) => void;
    setReminder: (v: boolean) => void;
    setThanks: (v: boolean) => void;
    setCancelled: (v: boolean) => void;
    setDeclined: (v: boolean) => void;
    setNoShow: (v: boolean) => void;
    setTmplReceived: (v: string) => void;
    setTmplConfirmed: (v: string) => void;
    setTmplReminder: (v: string) => void;
    setTmplThanks: (v: string) => void;
    setTmplCancelled: (v: string) => void;
    setTmplDeclined: (v: string) => void;
    setTmplNoShow: (v: string) => void;
    setSubjReceived?: (v: string) => void;
    setSubjConfirmed?: (v: string) => void;
    setSubjReminder?: (v: string) => void;
    setSubjThanks?: (v: string) => void;
    setSubjCancelled?: (v: string) => void;
    setSubjDeclined?: (v: string) => void;
    setSubjNoShow?: (v: string) => void;
  },
  emailSlice?: EmailChannelFormSlice,
): Record<ReservationNotificationKind, NotificationKindFieldState> {
  const subj = (kind: ReservationNotificationKind) => {
    if (!emailSlice) return undefined;
    const map: Record<ReservationNotificationKind, string> = {
      received: emailSlice.subjReceived,
      confirmed: emailSlice.subjConfirmed,
      reminder: emailSlice.subjReminder,
      thanks: emailSlice.subjThanks,
      cancelled: emailSlice.subjCancelled,
      declined: emailSlice.subjDeclined,
      no_show: emailSlice.subjNoShow,
    };
    return map[kind];
  };
  const setSubj = (kind: ReservationNotificationKind) => {
    if (!emailSlice) return undefined;
    const map: Record<ReservationNotificationKind, ((v: string) => void) | undefined> =
      {
        received: setters.setSubjReceived,
        confirmed: setters.setSubjConfirmed,
        reminder: setters.setSubjReminder,
        thanks: setters.setSubjThanks,
        cancelled: setters.setSubjCancelled,
        declined: setters.setSubjDeclined,
        no_show: setters.setSubjNoShow,
      };
    return map[kind];
  };
  return {
    received: {
      enabled: slice.received,
      template: slice.tmplReceived,
      subject: subj("received"),
      setEnabled: setters.setReceived,
      setTemplate: setters.setTmplReceived,
      setSubject: setSubj("received"),
    },
    confirmed: {
      enabled: slice.confirmed,
      template: slice.tmplConfirmed,
      subject: subj("confirmed"),
      setEnabled: setters.setConfirmed,
      setTemplate: setters.setTmplConfirmed,
      setSubject: setSubj("confirmed"),
    },
    reminder: {
      enabled: slice.reminder,
      template: slice.tmplReminder,
      subject: subj("reminder"),
      setEnabled: setters.setReminder,
      setTemplate: setters.setTmplReminder,
      setSubject: setSubj("reminder"),
    },
    thanks: {
      enabled: slice.thanks,
      template: slice.tmplThanks,
      subject: subj("thanks"),
      setEnabled: setters.setThanks,
      setTemplate: setters.setTmplThanks,
      setSubject: setSubj("thanks"),
    },
    cancelled: {
      enabled: slice.cancelled,
      template: slice.tmplCancelled,
      subject: subj("cancelled"),
      setEnabled: setters.setCancelled,
      setTemplate: setters.setTmplCancelled,
      setSubject: setSubj("cancelled"),
    },
    declined: {
      enabled: slice.declined,
      template: slice.tmplDeclined,
      subject: subj("declined"),
      setEnabled: setters.setDeclined,
      setTemplate: setters.setTmplDeclined,
      setSubject: setSubj("declined"),
    },
    no_show: {
      enabled: slice.noShow,
      template: slice.tmplNoShow,
      subject: subj("no_show"),
      setEnabled: setters.setNoShow,
      setTemplate: setters.setTmplNoShow,
      setSubject: setSubj("no_show"),
    },
  };
}

export function ReservationSettingsForm() {
  const platformFlags = usePlatformMessagingFlags();
  const { restaurantId, supabaseEnvOk, ready: workspaceReady } =
    useWorkspaceRestaurantUuid();
  const [minutes, setMinutes] = useState("120");
  const [leadTimeHours, setLeadTimeHours] = useState("2");
  const [minBeforeCloseMinutes, setMinBeforeCloseMinutes] = useState("60");
  const [bookingTimeStepMinutes, setBookingTimeStepMinutes] = useState("15");
  const [embedFormFooterText, setEmbedFormFooterText] = useState("");
  const [guestManageUrl, setGuestManageUrl] = useState("");
  const [emailSenderName, setEmailSenderName] = useState("");
  const [whatsapp, setWhatsapp] = useState<ChannelFormSlice>(defaultChannelSlice);
  const [email, setEmail] = useState<EmailChannelFormSlice>(defaultEmailChannelSlice);
  const [whatsappReview, setWhatsappReview] = useState<ReviewRequestIncludes>(
    defaultReviewRequestIncludes,
  );
  const [emailReview, setEmailReview] = useState<ReviewRequestIncludes>(
    defaultReviewRequestIncludes,
  );
  const [reviewGoogleUrl, setReviewGoogleUrl] = useState("");
  const [reviewFacebookUrl, setReviewFacebookUrl] = useState("");
  const [walkInEnabled, setWalkInEnabled] = useState(false);
  const [testWhatsappPhone, setTestWhatsappPhone] = useState("");
  const [testEmailAddress, setTestEmailAddress] = useState("");
  const [sendingTestKind, setSendingTestKind] = useState<{
    channel: "whatsapp" | "email";
    kind: WhatsappMessageKind;
  } | null>(null);
  const {
    loading: reviewConnectionsLoading,
    googleConnected,
    facebookConnected,
  } = useReviewPlatformConnections(restaurantId);
  const {
    loading: channelConnectionsLoading,
    instagramConnected,
  } = useRestaurantChannelConnections(restaurantId);
  const [statusColorsByCode, setStatusColorsByCode] = useState<Map<string, string>>(
    () => new Map(),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const savedSnapshotRef = useRef<string | null>(null);
  const formRef = useRef<HTMLFormElement | null>(null);

  const patchWhatsapp = (patch: Partial<ChannelFormSlice>) =>
    setWhatsapp((c) => ({ ...c, ...patch }));
  const patchEmail = (patch: Partial<EmailChannelFormSlice>) =>
    setEmail((c) => ({ ...c, ...patch }));

  const currentSnapshot = useMemo<SettingsSnapshot>(
    () => ({
      minutes,
      leadTimeHours,
      minBeforeCloseMinutes,
      bookingTimeStepMinutes,
      embedFormFooterText,
      guestManageUrl,
      emailSenderName,
      whatsapp,
      email,
      whatsappReview,
      emailReview,
      reviewGoogleUrl,
      reviewFacebookUrl,
      walkInEnabled,
    }),
    [
      minutes,
      leadTimeHours,
      minBeforeCloseMinutes,
      bookingTimeStepMinutes,
      embedFormFooterText,
      guestManageUrl,
      emailSenderName,
      whatsapp,
      email,
      whatsappReview,
      emailReview,
      reviewGoogleUrl,
      reviewFacebookUrl,
      walkInEnabled,
    ],
  );

  const dirty = useMemo(() => {
    if (savedSnapshotRef.current === null || loading) return false;
    return JSON.stringify(currentSnapshot) !== savedSnapshotRef.current;
  }, [currentSnapshot, loading]);

  useEffect(() => {
    void (async () => {
      const { data } = await fetchReservationStatuses();
      const map = new Map<string, string>();
      for (const s of data) {
        if (s.code && s.color_hex) map.set(s.code, s.color_hex);
      }
      setStatusColorsByCode(map);
    })();
  }, []);

  useEffect(() => {
    if (!restaurantId) return;
    let cancel = false;
    setLoading(true);
    savedSnapshotRef.current = null;
    void (async () => {
      const { data, error } = await fetchReservationSettings(restaurantId);
      if (cancel) return;
      setLoading(false);
      if (error) {
        toast.error(error.message);
        return;
      }
      const next = rowToSnapshot(data);
      setMinutes(next.minutes);
      setLeadTimeHours(next.leadTimeHours);
      setMinBeforeCloseMinutes(next.minBeforeCloseMinutes);
      setBookingTimeStepMinutes(next.bookingTimeStepMinutes);
      setEmbedFormFooterText(next.embedFormFooterText);
      setGuestManageUrl(next.guestManageUrl);
      setEmailSenderName(next.emailSenderName);
      setWhatsapp(next.whatsapp);
      setEmail(next.email);
      setWhatsappReview(next.whatsappReview);
      setEmailReview(next.emailReview);
      setReviewGoogleUrl(next.reviewGoogleUrl);
      setReviewFacebookUrl(next.reviewFacebookUrl);
      setWalkInEnabled(next.walkInEnabled);
      savedSnapshotRef.current = JSON.stringify(next);
    })();
    return () => {
      cancel = true;
    };
  }, [restaurantId]);

  const waFields = buildFieldsByKind(whatsapp, {
    setReceived: (v) => patchWhatsapp({ received: v }),
    setConfirmed: (v) => patchWhatsapp({ confirmed: v }),
    setReminder: (v) => patchWhatsapp({ reminder: v }),
    setThanks: (v) => patchWhatsapp({ thanks: v }),
    setCancelled: (v) => patchWhatsapp({ cancelled: v }),
    setDeclined: (v) => patchWhatsapp({ declined: v }),
    setNoShow: (v) => patchWhatsapp({ noShow: v }),
    setTmplReceived: (v) => patchWhatsapp({ tmplReceived: v }),
    setTmplConfirmed: (v) => patchWhatsapp({ tmplConfirmed: v }),
    setTmplReminder: (v) => patchWhatsapp({ tmplReminder: v }),
    setTmplThanks: (v) => patchWhatsapp({ tmplThanks: v }),
    setTmplCancelled: (v) => patchWhatsapp({ tmplCancelled: v }),
    setTmplDeclined: (v) => patchWhatsapp({ tmplDeclined: v }),
    setTmplNoShow: (v) => patchWhatsapp({ tmplNoShow: v }),
  });

  const emFields = buildFieldsByKind(
    email,
    {
      setReceived: (v) => patchEmail({ received: v }),
      setConfirmed: (v) => patchEmail({ confirmed: v }),
      setReminder: (v) => patchEmail({ reminder: v }),
      setThanks: (v) => patchEmail({ thanks: v }),
      setCancelled: (v) => patchEmail({ cancelled: v }),
      setDeclined: (v) => patchEmail({ declined: v }),
      setNoShow: (v) => patchEmail({ noShow: v }),
      setTmplReceived: (v) => patchEmail({ tmplReceived: v }),
      setTmplConfirmed: (v) => patchEmail({ tmplConfirmed: v }),
      setTmplReminder: (v) => patchEmail({ tmplReminder: v }),
      setTmplThanks: (v) => patchEmail({ tmplThanks: v }),
      setTmplCancelled: (v) => patchEmail({ tmplCancelled: v }),
      setTmplDeclined: (v) => patchEmail({ tmplDeclined: v }),
      setTmplNoShow: (v) => patchEmail({ tmplNoShow: v }),
      setSubjReceived: (v) => patchEmail({ subjReceived: v }),
      setSubjConfirmed: (v) => patchEmail({ subjConfirmed: v }),
      setSubjReminder: (v) => patchEmail({ subjReminder: v }),
      setSubjThanks: (v) => patchEmail({ subjThanks: v }),
      setSubjCancelled: (v) => patchEmail({ subjCancelled: v }),
      setSubjDeclined: (v) => patchEmail({ subjDeclined: v }),
      setSubjNoShow: (v) => patchEmail({ subjNoShow: v }),
    },
    email,
  );

  const sendNotificationTest = async (
    channel: "whatsapp" | "email",
    kind: WhatsappMessageKind,
  ) => {
    if (!restaurantId) return;
    const to =
      channel === "whatsapp"
        ? testWhatsappPhone.trim()
        : testEmailAddress.trim();
    if (!to) {
      toast.error(
        channel === "whatsapp"
          ? "Bitte eine WhatsApp-Nummer für den Testversand eingeben."
          : "Bitte eine E-Mail-Adresse für den Testversand eingeben.",
      );
      return;
    }

    setSendingTestKind({ channel, kind });
    try {
      const slice = channel === "whatsapp" ? whatsapp : email;
      const body: Record<string, unknown> = {
        restaurantId,
        kind,
        to,
        template: channelTemplateForKind(slice, kind),
        guestManageUrlTemplate: guestManageUrl.trim() || null,
      };
      if (channel === "email") {
        body.subject = emailSubjectForKind(email, kind);
        body.emailSenderName = emailSenderName.trim() || null;
      }
      if (kind === "thanks") {
        body.reviewIncludes =
          channel === "whatsapp" ? whatsappReview : emailReview;
        body.reviewGoogleUrl = reviewGoogleUrl.trim() || null;
        body.reviewFacebookUrl = reviewFacebookUrl.trim() || null;
      }

      const res = await fetch(
        `/api/reservations/notifications/test-${channel}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        toast.error(
          typeof data.error === "string"
            ? data.error
            : "Testnachricht konnte nicht gesendet werden.",
        );
        return;
      }
      toast.success(
        channel === "whatsapp"
          ? "Testnachricht per WhatsApp gesendet."
          : "Test-E-Mail gesendet.",
      );
    } catch {
      toast.error("Testnachricht konnte nicht gesendet werden.");
    } finally {
      setSendingTestKind(null);
    }
  };

  const save = () => {
    if (!restaurantId) return;
    const n = Number.parseInt(minutes, 10);
    if (!Number.isFinite(n) || n < 15 || n > 1440) {
      toast.error("Bitte 15–1440 Minuten eingeben.");
      return;
    }
    const leadH = Number.parseFloat(leadTimeHours.replace(",", "."));
    if (!Number.isFinite(leadH) || leadH < 0 || leadH > 168) {
      toast.error("Vorlaufzeit: 0–168 Stunden.");
      return;
    }
    const minClose = Number.parseInt(minBeforeCloseMinutes, 10);
    if (!Number.isFinite(minClose) || minClose < 0 || minClose > 480) {
      toast.error("Mindestzeit vor Schließung: 0–480 Minuten.");
      return;
    }
    const bookingStep = normalizeBookingTimeStepMinutes(
      Number.parseInt(bookingTimeStepMinutes, 10),
    );
    const footerTrim = embedFormFooterText.trim();
    if (footerTrim.length > EMBED_FOOTER_TEXT_MAX) {
      toast.error(`Hinweistext: maximal ${EMBED_FOOTER_TEXT_MAX} Zeichen.`);
      return;
    }
    const waRh = Number.parseFloat(whatsapp.reminderHours.replace(",", "."));
    const waTh = Number.parseFloat(whatsapp.thanksHours.replace(",", "."));
    const emRh = Number.parseFloat(email.reminderHours.replace(",", "."));
    const emTh = Number.parseFloat(email.thanksHours.replace(",", "."));
    for (const [label, rh, th] of [
      ["WhatsApp", waRh, waTh],
      ["E-Mail", emRh, emTh],
    ] as const) {
      if (!Number.isFinite(rh) || rh < 0 || rh > 168) {
        toast.error(`${label} Erinnerung: 0–168 Stunden.`);
        return;
      }
      if (!Number.isFinite(th) || th < 0 || th > 168) {
        toast.error(`${label} Danke: 0–168 Stunden.`);
        return;
      }
    }
    const urlErr = validateGuestManageUrlTemplate(guestManageUrl);
    if (urlErr) {
      toast.error(urlErr);
      return;
    }
    if (!validateChannelTemplates(whatsapp, "WhatsApp")) return;
    if (!validateChannelTemplates(email, "E-Mail")) return;
    if (!validateEmailSubjects(email)) return;
    const senderErr = validateEmailSenderName(emailSenderName);
    if (senderErr) {
      toast.error(senderErr);
      return;
    }

    setSaving(true);
    void (async () => {
      const { error } = await upsertReservationSettings({
        restaurantId,
        defaultDwellMinutes: n,
        bookingLeadTimeHours: leadH,
        minMinutesBeforeClosing: minClose,
        bookingTimeStepMinutes: bookingStep,
        embedFormFooterText: footerTrim || null,
        guestManageUrlTemplate: guestManageUrl.trim() || null,
        whatsappReceivedEnabled: whatsapp.received,
        whatsappConfirmedEnabled: whatsapp.confirmed,
        whatsappReminderEnabled: whatsapp.reminder,
        whatsappReminderHoursBefore: waRh,
        whatsappThanksEnabled: whatsapp.thanks,
        whatsappThanksHoursAfter: waTh,
        whatsappCancelledEnabled: whatsapp.cancelled,
        whatsappDeclinedEnabled: whatsapp.declined,
        whatsappNoShowEnabled: whatsapp.noShow,
        whatsappReceivedTemplate: templateFormValueToDb(whatsapp.tmplReceived, "received"),
        whatsappConfirmedTemplate: templateFormValueToDb(
          whatsapp.tmplConfirmed,
          "confirmed",
        ),
        whatsappReminderTemplate: templateFormValueToDb(whatsapp.tmplReminder, "reminder"),
        whatsappThanksTemplate: templateFormValueToDb(whatsapp.tmplThanks, "thanks"),
        whatsappCancelledTemplate: templateFormValueToDb(
          whatsapp.tmplCancelled,
          "cancelled",
        ),
        whatsappDeclinedTemplate: templateFormValueToDb(whatsapp.tmplDeclined, "declined"),
        whatsappNoShowTemplate: templateFormValueToDb(whatsapp.tmplNoShow, "no_show"),
        emailReceivedEnabled: email.received,
        emailConfirmedEnabled: email.confirmed,
        emailReminderEnabled: email.reminder,
        emailReminderHoursBefore: emRh,
        emailThanksEnabled: email.thanks,
        emailThanksHoursAfter: emTh,
        emailCancelledEnabled: email.cancelled,
        emailDeclinedEnabled: email.declined,
        emailNoShowEnabled: email.noShow,
        emailReceivedTemplate: templateFormValueToDb(email.tmplReceived, "received"),
        emailConfirmedTemplate: templateFormValueToDb(email.tmplConfirmed, "confirmed"),
        emailReminderTemplate: templateFormValueToDb(email.tmplReminder, "reminder"),
        emailThanksTemplate: templateFormValueToDb(email.tmplThanks, "thanks"),
        emailCancelledTemplate: templateFormValueToDb(email.tmplCancelled, "cancelled"),
        emailDeclinedTemplate: templateFormValueToDb(email.tmplDeclined, "declined"),
        emailNoShowTemplate: templateFormValueToDb(email.tmplNoShow, "no_show"),
        emailSenderName: emailSenderName.trim() || null,
        emailReceivedSubject: emailSubjectFormValueToDb(email.subjReceived, "received"),
        emailConfirmedSubject: emailSubjectFormValueToDb(
          email.subjConfirmed,
          "confirmed",
        ),
        emailReminderSubject: emailSubjectFormValueToDb(email.subjReminder, "reminder"),
        emailThanksSubject: emailSubjectFormValueToDb(email.subjThanks, "thanks"),
        emailCancelledSubject: emailSubjectFormValueToDb(
          email.subjCancelled,
          "cancelled",
        ),
        emailDeclinedSubject: emailSubjectFormValueToDb(email.subjDeclined, "declined"),
        emailNoShowSubject: emailSubjectFormValueToDb(email.subjNoShow, "no_show"),
        whatsappReviewIncludeGwada: whatsappReview.includeGwada,
        whatsappReviewIncludeGoogle: whatsappReview.includeGoogle,
        whatsappReviewIncludeFacebook: whatsappReview.includeFacebook,
        emailReviewIncludeGwada: emailReview.includeGwada,
        emailReviewIncludeGoogle: emailReview.includeGoogle,
        emailReviewIncludeFacebook: emailReview.includeFacebook,
        reviewGoogleUrl: reviewGoogleUrl.trim() || null,
        reviewFacebookUrl: reviewFacebookUrl.trim() || null,
        walkInEnabled,
      });
      setSaving(false);
      if (error) toast.error(error.message);
      else {
        toast.success("Einstellungen gespeichert.");
        savedSnapshotRef.current = JSON.stringify(currentSnapshot);
      }
    })();
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
    <div className="space-y-0 pb-4">
      <form
        ref={formRef}
        className="contents"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Card className="border-border/50 shadow-card">
          <CardContent className="space-y-6">
            <div className="grid max-w-2xl gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label
                  htmlFor="dwell-default"
                  className="text-xs text-muted-foreground"
                >
                  Standard-Verweildauer (Minuten)
                </Label>
                <Input
                  id="dwell-default"
                  type="number"
                  min={15}
                  max={1440}
                  disabled={loading}
                  value={minutes}
                  onChange={(e) => setMinutes(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="booking-lead-time"
                  className="text-xs text-muted-foreground"
                >
                  Vorlaufzeit Online-Buchung (Stunden)
                </Label>
                <Input
                  id="booking-lead-time"
                  type="number"
                  min={0}
                  max={168}
                  step={0.5}
                  disabled={loading}
                  value={leadTimeHours}
                  onChange={(e) => setLeadTimeHours(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Im eingebetteten Formular können Gäste frühestens ab jetzt plus
                  diese Stunden reservieren.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="min-before-close"
                  className="text-xs text-muted-foreground"
                >
                  Mindestzeit vor Schließung (Minuten)
                </Label>
                <Input
                  id="min-before-close"
                  type="number"
                  min={0}
                  max={480}
                  step={15}
                  disabled={loading}
                  value={minBeforeCloseMinutes}
                  onChange={(e) => setMinBeforeCloseMinutes(e.target.value)}
                  className="h-11 rounded-xl border border-input bg-transparent px-3 text-sm tabular-nums"
                />
                <p className="text-xs text-muted-foreground">
                  Bei Schließung um 20:00 Uhr und 60 Minuten ist 19:00 Uhr der
                  späteste buchbare Beginn.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label
                  htmlFor="booking-time-step"
                  className="text-xs text-muted-foreground"
                >
                  Buchungs-Raster (Minuten)
                </Label>
                <Select
                  value={bookingTimeStepMinutes}
                  onValueChange={(v) => {
                    if (typeof v === "string") setBookingTimeStepMinutes(v);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger
                    id="booking-time-step"
                    className={appSelectTriggerAccentCn("h-11 w-full rounded-xl")}
                  >
                    <SelectValue placeholder="Raster wählen" />
                  </SelectTrigger>
                  <SelectContent>
                    {BOOKING_TIME_STEP_OPTIONS.map((step) => (
                      <SelectItem key={step} value={String(step)}>
                        {BOOKING_TIME_STEP_LABELS[step]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Gilt für Online-Buchung, Dashboard und Display-Tischbelegung.
                </p>
              </div>
            </div>

            <div className="max-w-2xl">
              <div className="flex items-start justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 px-4 py-3">
                <div className="space-y-1">
                  <Label htmlFor="walk-in-enabled" className="text-sm font-medium">
                    Walk-in / Laufkunde
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    Im Display können Gäste ohne Voranmeldung sofort an einen Tisch
                    platziert werden. Ohne Aktivierung erscheint die Funktion im
                    Display nicht.
                  </p>
                </div>
                <Switch
                  id="walk-in-enabled"
                  checked={walkInEnabled}
                  disabled={loading}
                  onCheckedChange={setWalkInEnabled}
                />
              </div>
            </div>

            <div className="max-w-2xl space-y-1.5">
              <Label
                htmlFor="embed-form-footer"
                className="text-xs text-muted-foreground"
              >
                Hinweistext unter dem Reservierungsformular
              </Label>
              <Textarea
                id="embed-form-footer"
                disabled={loading}
                value={embedFormFooterText}
                onChange={(e) => setEmbedFormFooterText(e.target.value)}
                placeholder="z. B. Parkplätze, Allergien, Dresscode …"
                maxLength={EMBED_FOOTER_TEXT_MAX}
                rows={4}
                className="min-h-[6rem] resize-y rounded-xl border border-input bg-transparent px-3 py-2.5 text-sm leading-relaxed"
              />
              <p className="text-xs text-muted-foreground">
                {publicSurfaceScopeHint("both")} Direkt vor dem Absenden-Button im
                Reservierungsformular (optional, max. {EMBED_FOOTER_TEXT_MAX} Zeichen).
              </p>
            </div>

            <Separator />

            <div className="max-w-xl space-y-1.5">
              <Label
                htmlFor="guest-manage-url"
                className="text-xs text-muted-foreground"
              >
                Link zum Ändern der Reservierung (optional)
              </Label>
              <Input
                id="guest-manage-url"
                type="url"
                disabled={loading}
                value={guestManageUrl}
                onChange={(e) => setGuestManageUrl(e.target.value)}
                placeholder="https://beispiel.de/reservierung?nr={nummer}&pin={pin}"
                className="h-11 rounded-xl font-mono text-sm"
                spellCheck={false}
              />
              <p className="text-xs text-muted-foreground">
                In Nachrichten als Platzhalter{" "}
                <span className="font-mono text-foreground">{"{link}"}</span>{" "}
                (wird nur eingefügt, wenn du den Platzhalter im Text verwendest).
                In der URL selbst optional{" "}
                <span className="font-mono text-foreground">{"{nummer}"}</span> /{" "}
                <span className="font-mono text-foreground">{"{pin}"}</span>.
              </p>
            </div>

            <Separator />

            {(platformFlags.googleBusinessEnabled ||
              platformFlags.facebookEnabled ||
              platformFlags.instagramEnabled) &&
            (googleConnected || facebookConnected || instagramConnected) ? (
              <ReservationPlatformBookingLinks
                restaurantId={restaurantId}
                googleConnected={googleConnected}
                facebookConnected={facebookConnected}
                instagramConnected={instagramConnected}
                connectionsLoading={
                  reviewConnectionsLoading || channelConnectionsLoading
                }
              />
            ) : null}

            <Separator />

            {platformFlags.whatsappEnabled ? (
            <ReservationNotificationChannelSection
              sectionId="reservation-whatsapp-settings-heading"
              collapsible
              defaultOpen={false}
              headerIcon={<WhatsAppGlyph className="size-5 shrink-0" />}
              headerTitle="WhatsApp Benachrichtigungen"
              sectionClassName={reservationWhatsappSettingsSectionClassName}
              intro={
                <p className="text-xs text-muted-foreground">
                  Voraussetzung: WhatsApp unter Einstellungen → Integrationen
                  verbunden.
                </p>
              }
              statusColorsByCode={statusColorsByCode}
              fieldsByKind={waFields}
              reminderHours={{
                value: whatsapp.reminderHours,
                onChange: (v) => patchWhatsapp({ reminderHours: v }),
              }}
              thanksHours={{
                value: whatsapp.thanksHours,
                onChange: (v) => patchWhatsapp({ thanksHours: v }),
              }}
              testRecipient={{
                value: testWhatsappPhone,
                onChange: setTestWhatsappPhone,
                label: "Testversand (WhatsApp-Nummer)",
                placeholder: "+49 170 1234567",
                inputMode: "tel",
              }}
              onSendTest={(kind) => void sendNotificationTest("whatsapp", kind)}
              sendingTestKind={
                sendingTestKind?.channel === "whatsapp"
                  ? sendingTestKind.kind
                  : null
              }
              thanksReviewExtras={
                <ReviewRequestPlatformsField
                  includes={whatsappReview}
                  onIncludesChange={(patch) =>
                    setWhatsappReview((r) => ({ ...r, ...patch }))
                  }
                  googleUrl={reviewGoogleUrl}
                  facebookUrl={reviewFacebookUrl}
                  onGoogleUrlChange={setReviewGoogleUrl}
                  onFacebookUrlChange={setReviewFacebookUrl}
                  showUrlFields
                  thanksEnabled={whatsapp.thanks}
                  loading={loading}
                  googleConnected={googleConnected}
                  facebookConnected={facebookConnected}
                  connectionsLoading={reviewConnectionsLoading}
                />
              }
              loading={loading}
            />
            ) : null}

            {platformFlags.emailEnabled ? (
            <ReservationNotificationChannelSection
              sectionId="reservation-email-settings-heading"
              collapsible
              defaultOpen={false}
              headerIcon={
                <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
              }
              headerTitle="E-Mail Benachrichtigungen"
              sectionClassName={reservationEmailSettingsSectionClassName}
              intro={
                <p className="text-xs text-muted-foreground">
                  Voraussetzung: E-Mail unter Einstellungen → Integrationen.
                  Ohne eigene Adresse: Absender contact@gwada.app.
                </p>
              }
              statusColorsByCode={statusColorsByCode}
              fieldsByKind={emFields}
              reminderHours={{
                value: email.reminderHours,
                onChange: (v) => patchEmail({ reminderHours: v }),
              }}
              thanksHours={{
                value: email.thanksHours,
                onChange: (v) => patchEmail({ thanksHours: v }),
              }}
              testRecipient={{
                value: testEmailAddress,
                onChange: setTestEmailAddress,
                label: "Testversand (E-Mail)",
                placeholder: "gast@beispiel.de",
                inputMode: "email",
              }}
              onSendTest={(kind) => void sendNotificationTest("email", kind)}
              sendingTestKind={
                sendingTestKind?.channel === "email"
                  ? sendingTestKind.kind
                  : null
              }
              thanksReviewExtras={
                <ReviewRequestPlatformsField
                  includes={emailReview}
                  onIncludesChange={(patch) =>
                    setEmailReview((r) => ({ ...r, ...patch }))
                  }
                  googleUrl={reviewGoogleUrl}
                  facebookUrl={reviewFacebookUrl}
                  onGoogleUrlChange={setReviewGoogleUrl}
                  onFacebookUrlChange={setReviewFacebookUrl}
                  showUrlFields={!platformFlags.whatsappEnabled}
                  thanksEnabled={email.thanks}
                  loading={loading}
                  googleConnected={googleConnected}
                  facebookConnected={facebookConnected}
                  connectionsLoading={reviewConnectionsLoading}
                />
              }
              loading={loading}
              showEmailSubjects
              emailSenderName={emailSenderName}
              onEmailSenderNameChange={setEmailSenderName}
            />
            ) : null}
          </CardContent>
        </Card>

        <SettingsStickySaveBar show={dirty}>
          <Button
            type="submit"
            disabled={saving || loading}
            className={cn(
              "h-11 w-full min-w-[12rem] sm:w-auto",
              settingsAccentSaveButtonClassName,
            )}
          >
            Speichern
          </Button>
        </SettingsStickySaveBar>
      </form>
    </div>
  );
}
