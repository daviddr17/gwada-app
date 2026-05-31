import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isUuidRestaurantId } from "@/lib/supabase/opening-hours-db";
import type { WhatsappMessageKind } from "@/lib/whatsapp/reservation-whatsapp-message-config";

export type RestaurantReservationSettingsRow = {
  restaurant_id: string;
  default_dwell_minutes: number;
  booking_lead_time_hours: number;
  min_minutes_before_closing: number;
  booking_time_step_minutes: number;
  embed_form_footer_text: string | null;
  guest_manage_url_template: string | null;
  whatsapp_received_enabled: boolean;
  whatsapp_confirmed_enabled: boolean;
  whatsapp_reminder_enabled: boolean;
  whatsapp_reminder_hours_before: number;
  whatsapp_thanks_enabled: boolean;
  whatsapp_thanks_hours_after: number;
  whatsapp_cancelled_enabled: boolean;
  whatsapp_declined_enabled: boolean;
  whatsapp_no_show_enabled: boolean;
  whatsapp_received_template: string | null;
  whatsapp_confirmed_template: string | null;
  whatsapp_reminder_template: string | null;
  whatsapp_thanks_template: string | null;
  whatsapp_cancelled_template: string | null;
  whatsapp_declined_template: string | null;
  whatsapp_no_show_template: string | null;
  email_received_enabled: boolean;
  email_confirmed_enabled: boolean;
  email_reminder_enabled: boolean;
  email_reminder_hours_before: number;
  email_thanks_enabled: boolean;
  email_thanks_hours_after: number;
  email_cancelled_enabled: boolean;
  email_declined_enabled: boolean;
  email_no_show_enabled: boolean;
  email_received_template: string | null;
  email_confirmed_template: string | null;
  email_reminder_template: string | null;
  email_thanks_template: string | null;
  email_cancelled_template: string | null;
  email_declined_template: string | null;
  email_no_show_template: string | null;
  email_sender_name: string | null;
  email_received_subject: string | null;
  email_confirmed_subject: string | null;
  email_reminder_subject: string | null;
  email_thanks_subject: string | null;
  email_cancelled_subject: string | null;
  email_declined_subject: string | null;
  email_no_show_subject: string | null;
};

const SETTINGS_SELECT = [
  "restaurant_id",
  "default_dwell_minutes",
  "booking_lead_time_hours",
  "min_minutes_before_closing",
  "booking_time_step_minutes",
  "embed_form_footer_text",
  "guest_manage_url_template",
  "whatsapp_received_enabled",
  "whatsapp_confirmed_enabled",
  "whatsapp_reminder_enabled",
  "whatsapp_reminder_hours_before",
  "whatsapp_thanks_enabled",
  "whatsapp_thanks_hours_after",
  "whatsapp_cancelled_enabled",
  "whatsapp_declined_enabled",
  "whatsapp_no_show_enabled",
  "whatsapp_received_template",
  "whatsapp_confirmed_template",
  "whatsapp_reminder_template",
  "whatsapp_thanks_template",
  "whatsapp_cancelled_template",
  "whatsapp_declined_template",
  "whatsapp_no_show_template",
  "email_received_enabled",
  "email_confirmed_enabled",
  "email_reminder_enabled",
  "email_reminder_hours_before",
  "email_thanks_enabled",
  "email_thanks_hours_after",
  "email_cancelled_enabled",
  "email_declined_enabled",
  "email_no_show_enabled",
  "email_received_template",
  "email_confirmed_template",
  "email_reminder_template",
  "email_thanks_template",
  "email_cancelled_template",
  "email_declined_template",
  "email_no_show_template",
  "email_sender_name",
  "email_received_subject",
  "email_confirmed_subject",
  "email_reminder_subject",
  "email_thanks_subject",
  "email_cancelled_subject",
  "email_declined_subject",
  "email_no_show_subject",
].join(", ");

const WHATSAPP_TEMPLATE_KEY: Record<
  WhatsappMessageKind,
  keyof Pick<
    RestaurantReservationSettingsRow,
    | "whatsapp_received_template"
    | "whatsapp_confirmed_template"
    | "whatsapp_reminder_template"
    | "whatsapp_thanks_template"
    | "whatsapp_cancelled_template"
    | "whatsapp_declined_template"
    | "whatsapp_no_show_template"
  >
> = {
  received: "whatsapp_received_template",
  confirmed: "whatsapp_confirmed_template",
  reminder: "whatsapp_reminder_template",
  thanks: "whatsapp_thanks_template",
  cancelled: "whatsapp_cancelled_template",
  declined: "whatsapp_declined_template",
  no_show: "whatsapp_no_show_template",
};

const EMAIL_TEMPLATE_KEY: Record<
  WhatsappMessageKind,
  keyof Pick<
    RestaurantReservationSettingsRow,
    | "email_received_template"
    | "email_confirmed_template"
    | "email_reminder_template"
    | "email_thanks_template"
    | "email_cancelled_template"
    | "email_declined_template"
    | "email_no_show_template"
  >
> = {
  received: "email_received_template",
  confirmed: "email_confirmed_template",
  reminder: "email_reminder_template",
  thanks: "email_thanks_template",
  cancelled: "email_cancelled_template",
  declined: "email_declined_template",
  no_show: "email_no_show_template",
};

const EMAIL_SUBJECT_KEY: Record<
  WhatsappMessageKind,
  keyof Pick<
    RestaurantReservationSettingsRow,
    | "email_received_subject"
    | "email_confirmed_subject"
    | "email_reminder_subject"
    | "email_thanks_subject"
    | "email_cancelled_subject"
    | "email_declined_subject"
    | "email_no_show_subject"
  >
> = {
  received: "email_received_subject",
  confirmed: "email_confirmed_subject",
  reminder: "email_reminder_subject",
  thanks: "email_thanks_subject",
  cancelled: "email_cancelled_subject",
  declined: "email_declined_subject",
  no_show: "email_no_show_subject",
};

export function reservationSettingsEmailSubjectStored(
  row: RestaurantReservationSettingsRow | null | undefined,
  kind: WhatsappMessageKind,
): string | null | undefined {
  if (!row) return null;
  return row[EMAIL_SUBJECT_KEY[kind]];
}

export function reservationSettingsTemplateStored(
  row: RestaurantReservationSettingsRow | null | undefined,
  channel: "whatsapp" | "email",
  kind: WhatsappMessageKind,
): string | null | undefined {
  if (!row) return null;
  const key =
    channel === "whatsapp" ? WHATSAPP_TEMPLATE_KEY[kind] : EMAIL_TEMPLATE_KEY[kind];
  return row[key];
}

export async function fetchReservationSettings(
  restaurantId: string,
): Promise<{ data: RestaurantReservationSettingsRow | null; error: Error | null }> {
  if (!isUuidRestaurantId(restaurantId)) return { data: null, error: null };
  const sb = createSupabaseBrowserClient();
  const { data, error } = await sb
    .from("restaurant_reservation_settings")
    .select(SETTINGS_SELECT)
    .eq("restaurant_id", restaurantId)
    .maybeSingle();
  if (error) return { data: null, error: new Error(error.message) };
  return { data: data as RestaurantReservationSettingsRow | null, error: null };
}

export type UpsertReservationSettingsParams = {
  restaurantId: string;
  defaultDwellMinutes: number;
  bookingLeadTimeHours: number;
  minMinutesBeforeClosing: number;
  bookingTimeStepMinutes: number;
  embedFormFooterText: string | null;
  guestManageUrlTemplate: string | null;
  whatsappReceivedEnabled: boolean;
  whatsappConfirmedEnabled: boolean;
  whatsappReminderEnabled: boolean;
  whatsappReminderHoursBefore: number;
  whatsappThanksEnabled: boolean;
  whatsappThanksHoursAfter: number;
  whatsappCancelledEnabled: boolean;
  whatsappDeclinedEnabled: boolean;
  whatsappNoShowEnabled: boolean;
  whatsappReceivedTemplate: string | null;
  whatsappConfirmedTemplate: string | null;
  whatsappReminderTemplate: string | null;
  whatsappThanksTemplate: string | null;
  whatsappCancelledTemplate: string | null;
  whatsappDeclinedTemplate: string | null;
  whatsappNoShowTemplate: string | null;
  emailReceivedEnabled: boolean;
  emailConfirmedEnabled: boolean;
  emailReminderEnabled: boolean;
  emailReminderHoursBefore: number;
  emailThanksEnabled: boolean;
  emailThanksHoursAfter: number;
  emailCancelledEnabled: boolean;
  emailDeclinedEnabled: boolean;
  emailNoShowEnabled: boolean;
  emailReceivedTemplate: string | null;
  emailConfirmedTemplate: string | null;
  emailReminderTemplate: string | null;
  emailThanksTemplate: string | null;
  emailCancelledTemplate: string | null;
  emailDeclinedTemplate: string | null;
  emailNoShowTemplate: string | null;
  emailSenderName: string | null;
  emailReceivedSubject: string | null;
  emailConfirmedSubject: string | null;
  emailReminderSubject: string | null;
  emailThanksSubject: string | null;
  emailCancelledSubject: string | null;
  emailDeclinedSubject: string | null;
  emailNoShowSubject: string | null;
};

export async function upsertReservationSettings(
  params: UpsertReservationSettingsParams,
): Promise<{ error: Error | null }> {
  const sb = createSupabaseBrowserClient();
  const { error } = await sb.from("restaurant_reservation_settings").upsert(
    {
      restaurant_id: params.restaurantId,
      default_dwell_minutes: params.defaultDwellMinutes,
      booking_lead_time_hours: params.bookingLeadTimeHours,
      min_minutes_before_closing: params.minMinutesBeforeClosing,
      booking_time_step_minutes: params.bookingTimeStepMinutes,
      embed_form_footer_text: params.embedFormFooterText,
      guest_manage_url_template: params.guestManageUrlTemplate,
      whatsapp_received_enabled: params.whatsappReceivedEnabled,
      whatsapp_confirmed_enabled: params.whatsappConfirmedEnabled,
      whatsapp_reminder_enabled: params.whatsappReminderEnabled,
      whatsapp_reminder_hours_before: params.whatsappReminderHoursBefore,
      whatsapp_thanks_enabled: params.whatsappThanksEnabled,
      whatsapp_thanks_hours_after: params.whatsappThanksHoursAfter,
      whatsapp_cancelled_enabled: params.whatsappCancelledEnabled,
      whatsapp_declined_enabled: params.whatsappDeclinedEnabled,
      whatsapp_no_show_enabled: params.whatsappNoShowEnabled,
      whatsapp_received_template: params.whatsappReceivedTemplate,
      whatsapp_confirmed_template: params.whatsappConfirmedTemplate,
      whatsapp_reminder_template: params.whatsappReminderTemplate,
      whatsapp_thanks_template: params.whatsappThanksTemplate,
      whatsapp_cancelled_template: params.whatsappCancelledTemplate,
      whatsapp_declined_template: params.whatsappDeclinedTemplate,
      whatsapp_no_show_template: params.whatsappNoShowTemplate,
      email_received_enabled: params.emailReceivedEnabled,
      email_confirmed_enabled: params.emailConfirmedEnabled,
      email_reminder_enabled: params.emailReminderEnabled,
      email_reminder_hours_before: params.emailReminderHoursBefore,
      email_thanks_enabled: params.emailThanksEnabled,
      email_thanks_hours_after: params.emailThanksHoursAfter,
      email_cancelled_enabled: params.emailCancelledEnabled,
      email_declined_enabled: params.emailDeclinedEnabled,
      email_no_show_enabled: params.emailNoShowEnabled,
      email_received_template: params.emailReceivedTemplate,
      email_confirmed_template: params.emailConfirmedTemplate,
      email_reminder_template: params.emailReminderTemplate,
      email_thanks_template: params.emailThanksTemplate,
      email_cancelled_template: params.emailCancelledTemplate,
      email_declined_template: params.emailDeclinedTemplate,
      email_no_show_template: params.emailNoShowTemplate,
      email_sender_name: params.emailSenderName,
      email_received_subject: params.emailReceivedSubject,
      email_confirmed_subject: params.emailConfirmedSubject,
      email_reminder_subject: params.emailReminderSubject,
      email_thanks_subject: params.emailThanksSubject,
      email_cancelled_subject: params.emailCancelledSubject,
      email_declined_subject: params.emailDeclinedSubject,
      email_no_show_subject: params.emailNoShowSubject,
    },
    { onConflict: "restaurant_id" },
  );
  if (error) return { error: new Error(error.message) };
  return { error: null };
}
