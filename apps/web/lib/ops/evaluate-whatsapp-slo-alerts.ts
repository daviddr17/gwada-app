import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadDeliveryHealthSnapshot } from "@/lib/ops/load-delivery-health";
import { sendOpsAlertEmail } from "@/lib/ops/send-ops-alert-email";

const ALERT_KEY = "whatsapp_confirm_slo";
const ALERT_COOLDOWN_MS = 30 * 60 * 1000;

function alertFingerprint(snapshot: Awaited<ReturnType<typeof loadDeliveryHealthSnapshot>>): string {
  const staleJobs = snapshot.cron.filter((c) => c.stale).map((c) => c.jobName).sort();
  const hung = snapshot.restaurants
    .filter((r) => r.hungSending > 0 || r.failedOpen > 0)
    .map((r) => r.restaurantId)
    .sort();
  return [
    snapshot.slo.breached ? "slo" : "ok",
    `late:${snapshot.slo.late}`,
    `stale:${staleJobs.join(",")}`,
    `hung:${hung.join(",")}`,
  ].join("|");
}

export async function evaluateWhatsappSloAlerts(
  admin: SupabaseClient,
): Promise<{
  alerted: boolean;
  fingerprint: string;
  skipped: string | null;
}> {
  const snapshot = await loadDeliveryHealthSnapshot(admin);
  const fingerprint = alertFingerprint(snapshot);
  const needsAlert =
    snapshot.slo.breached ||
    snapshot.cron.some((c) => c.stale) ||
    snapshot.restaurants.some((r) => r.hungSending > 0);

  if (!needsAlert) {
    return { alerted: false, fingerprint, skipped: "healthy" };
  }

  const { data: prior } = await admin
    .from("platform_alert_state")
    .select("last_sent_at, last_fingerprint")
    .eq("alert_key", ALERT_KEY)
    .maybeSingle();

  const lastSentAt =
    prior && typeof (prior as { last_sent_at?: string }).last_sent_at === "string"
      ? Date.parse((prior as { last_sent_at: string }).last_sent_at)
      : NaN;
  const lastFingerprint =
    prior && typeof (prior as { last_fingerprint?: string }).last_fingerprint === "string"
      ? (prior as { last_fingerprint: string }).last_fingerprint
      : null;

  if (
    lastFingerprint === fingerprint &&
    Number.isFinite(lastSentAt) &&
    Date.now() - lastSentAt < ALERT_COOLDOWN_MS
  ) {
    return { alerted: false, fingerprint, skipped: "cooldown" };
  }

  const stale = snapshot.cron.filter((c) => c.stale).map((c) => c.jobName);
  const problemRestaurants = snapshot.restaurants.slice(0, 8).map((r) => {
    const bits = [
      r.restaurantName,
      r.hungSending ? `${r.hungSending} hängend` : null,
      r.failedOpen ? `${r.failedOpen} Fehler` : null,
      r.wahaStatus && r.wahaStatus.toLowerCase() !== "working"
        ? `WAHA ${r.wahaStatus}`
        : null,
    ].filter(Boolean);
    return `- ${bits.join(" · ")}`;
  });

  const text = [
    `SLO: ${(snapshot.slo.ratio * 100).toFixed(1)}% der Bestätigungen in ${snapshot.slo.targetMs / 1000}s (Ziel ${snapshot.slo.targetRatio * 100}%).`,
    `Stichprobe: ${snapshot.slo.sample} · pünktlich ${snapshot.slo.onTime} · spät ${snapshot.slo.late} · offen ${snapshot.slo.pending}.`,
    stale.length > 0 ? `Cron-Lag: ${stale.join(", ")}` : "Cron-Lag: keiner",
    problemRestaurants.length > 0
      ? `Restaurants:\n${problemRestaurants.join("\n")}`
      : "Keine Restaurant-Ausfälle in der Outbox.",
    "",
    "Ops: https://gwada.app/superadmin/ops",
  ].join("\n");

  const mailed = await sendOpsAlertEmail({
    subject: snapshot.slo.breached
      ? "Gwada On-Call: WhatsApp-Bestätigungen unter SLO"
      : "Gwada On-Call: WhatsApp/Cron auffällig",
    headline: snapshot.slo.breached
      ? "Bestätigungen unter SLO"
      : "Zustellung oder Cron auffällig",
    text,
  });

  if (mailed.sent === 0) {
    return { alerted: false, fingerprint, skipped: mailed.skipped };
  }

  await admin.from("platform_alert_state").upsert({
    alert_key: ALERT_KEY,
    last_sent_at: new Date().toISOString(),
    last_fingerprint: fingerprint,
    updated_at: new Date().toISOString(),
  });

  return { alerted: true, fingerprint, skipped: null };
}
