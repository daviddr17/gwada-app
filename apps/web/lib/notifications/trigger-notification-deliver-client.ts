/** Push-Zustellung für frisch angelegte notification_events anstoßen (Fallback: Cron). */
export async function triggerNotificationDeliverReferences(params: {
  restaurantId: string;
  module: string;
  referenceIds: string[];
}): Promise<void> {
  if (!params.referenceIds.length) return;

  try {
    await fetch("/api/notifications/deliver-references", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
  } catch {
    // Cron-Fallback
  }
}

/** Sofort-Push nach Bestellstatus ordered/closed. Cron bleibt Fallback. */
export function triggerPoStatusNotificationDeliver(params: {
  restaurantId: string;
  orderId: string;
  status: "ordered" | "closed";
}): void {
  void fetch("/api/notifications/po-status-deliver", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  }).catch(() => {
    // Cron-Fallback
  });
}
