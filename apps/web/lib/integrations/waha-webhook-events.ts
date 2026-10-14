/** WAHA session webhook events Gwada must receive. */
export const WAHA_SESSION_WEBHOOK_EVENTS = [
  "message",
  "message.any",
  "message.ack",
] as const;

export type WahaSessionWebhookEvent = (typeof WAHA_SESSION_WEBHOOK_EVENTS)[number];
