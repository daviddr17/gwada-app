import "server-only";

import {
  AUTH_EMAIL_SEND_TIMEOUT_MS,
  raceWithTimeout,
} from "@/lib/supabase/race-timeout";

/** Verhindert hängende Route Handler bei SMTP/GoTrue generateLink. */
export async function withAuthEmailSendTimeout<T>(
  promiseLike: PromiseLike<T>,
): Promise<T> {
  return raceWithTimeout(
    promiseLike,
    AUTH_EMAIL_SEND_TIMEOUT_MS,
    "E-Mail-Versand",
  );
}
