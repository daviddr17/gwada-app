/** Module, die im Dashboard-„Heute live“-Feed erscheinen (notification_events). */
export const LIVE_ACTIVITY_FEED_MODULES = [
  "staff_display_clock_in",
  "staff_display_clock_out",
  "staff_shift_start",
  "staff_shift_end",
  "reservations_pending",
  "reservations_change_request",
  "reservations_cancellation",
  "messages",
  "inventory_low_stock",
  "inventory_po_delivery_due",
] as const;
