import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  deliveryHealthAlertFingerprint,
  deliveryHealthNeedsPage,
  pageableStaleCronJobs,
  restaurantNeedsPage,
} from "@/lib/ops/delivery-health";
import { loadDeliveryHealthSnapshot } from "@/lib/ops/load-delivery-health";
import {
  ALERT_COOLDOWN_MS,
  encodeAlertFingerprint,
  opsAlertSubject,
  parseAlertFingerprintState,
} from "@/lib/ops/ops-alert-escalation";
import { sendOpsAlertEmail } from "@/lib/ops/send-ops-alert-email";

const ALERT_KEY = "whatsapp_confirm_slo";

export async function evaluateWhatsappSloAlerts(
  admin: SupabaseClient,
): Promise<{
  alerted: boolean;
  fingerprint: string;
  skipped: string | null;
}> {
  const snapshot = await loadDeliveryHealthSnapshot(admin);
  const fingerprint = deliveryHealthAlertFingerprint(snapshot);
  const needsAlert = deliveryHealthNeedsPage(snapshot);

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

  const escalation = parseAlertFingerprintState(lastFingerprint, fingerprint);
  if (
    escalation.sameIssue &&
    Number.isFinite(lastSentAt) &&
    Date.now() - lastSentAt < ALERT_COOLDOWN_MS
  ) {
    return { alerted: false, fingerprint, skipped: "cooldown" };
  }

  const stale = pageableStaleCronJobs(snapshot.cron);
  const problemRestaurants = snapshot.restaurants
    .filter(
      (r) =>
        restaurantNeedsPage(r) ||
        r.failedOpen > 0 ||
        r.emailFailedOpen > 0,
    )
    .slice(0, 8)
    .map((r) => {
      const bits = [
        r.restaurantName,
        r.hungSending ? `${r.hungSending} WA hängend` : null,
        r.emailHungSending ? `${r.emailHungSending} E-Mail hängend` : null,
        r.failedOpen ? `${r.failedOpen} WA-Fehler` : null,
        r.emailFailedOpen ? `${r.emailFailedOpen} E-Mail-Fehler` : null,
        r.notificationsStuck ? `${r.notificationsStuck} Push hängend` : null,
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
    subject: opsAlertSubject({
      sloBreached: snapshot.slo.breached,
      escalationCount: escalation.nextCount,
    }),
    headline:
      escalation.nextCount >= 2
        ? `ESKALATION ${escalation.nextCount}x — ${
            snapshot.slo.breached
              ? "Bestätigungen unter SLO"
              : "Zustellung oder Zustell-Cron auffällig"
          }`
        : snapshot.slo.breached
          ? "Bestätigungen unter SLO"
          : "Zustellung oder Zustell-Cron auffällig",
    text,
  });

  if (mailed.sent === 0) {
    return { alerted: false, fingerprint, skipped: mailed.skipped };
  }

  await admin.from("platform_alert_state").upsert({
    alert_key: ALERT_KEY,
    last_sent_at: new Date().toISOString(),
    last_fingerprint: encodeAlertFingerprint(fingerprint, escalation.nextCount),
    updated_at: new Date().toISOString(),
  });

  return { alerted: true, fingerprint, skipped: null };
}
