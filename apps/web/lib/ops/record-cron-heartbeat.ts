import "server-only";

import { sanitizeOpsText } from "@/lib/ops/sanitize-ops-text";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export async function recordCronHeartbeat(params: {
  jobName: string;
  ok: boolean;
  payload?: Record<string, unknown>;
  error?: string | null;
}): Promise<void> {
  const admin = createSupabaseAdminClient();
  if (!admin) return;
  const { error } = await admin.rpc("record_cron_heartbeat", {
    p_job_name: params.jobName,
    p_ok: params.ok,
    p_payload: params.payload ?? {},
    p_error: params.error ? sanitizeOpsText(params.error) : null,
  });
  if (error) {
    console.warn("[ops] heartbeat failed", params.jobName, error.message);
  }
}

export async function withCronHeartbeat<T extends Record<string, unknown>>(
  jobName: string,
  run: () => Promise<T>,
): Promise<T> {
  try {
    const payload = await run();
    await recordCronHeartbeat({ jobName, ok: true, payload });
    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "error";
    await recordCronHeartbeat({ jobName, ok: false, error: message });
    throw error;
  }
}
