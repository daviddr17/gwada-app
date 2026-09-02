import "server-only";

import {
  AUTH_EMAIL_PREPARE_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";

/** Verhindert hängende Route Handler bei GoTrue generateLink / Branding. */
export async function withAuthEmailPrepareTimeout<T>(
  promiseLike: PromiseLike<T>,
): Promise<T> {
  return raceWithTimeout(
    promiseLike,
    AUTH_EMAIL_PREPARE_TIMEOUT_MS,
    "E-Mail-Vorbereitung",
  );
}
