/** Anmeldung darf etwas länger dauern (Passwort-Hash auf dem Server), aber nicht unbegrenzt. */
export const GWADA_SUPABASE_SIGNIN_TIMEOUT_MS = 22_000;

/** Obergrenze für Auth-Mail-Vorbereitung (generateLink + Branding) — SMTP läuft danach in `after()`. */
export const AUTH_EMAIL_PREPARE_TIMEOUT_MS = 15_000;

/** @deprecated Use AUTH_EMAIL_PREPARE_TIMEOUT_MS */
export const AUTH_EMAIL_SEND_TIMEOUT_MS = AUTH_EMAIL_PREPARE_TIMEOUT_MS;

/** Browser-Timeout für `/api/auth/magic-link` und `/api/auth/forgot-password`. */
export const AUTH_EMAIL_FETCH_TIMEOUT_MS = 18_000;


/** Obergrenze für Browser→Supabase, damit UI nicht endlos hängt (TCP kann sonst sehr lange blockieren). */
export const GWADA_SUPABASE_FETCH_TIMEOUT_MS = 12_000;

/**
 * Löst mit `promise` auf oder bricht nach `ms` mit einer verständlichen Fehlermeldung ab
 * (Promise.race). Der Timeout wird in `finally` der Rückgabe immer gelöscht.
 * Akzeptiert echte Promises und thenables (z. B. Supabase-Query-Builder).
 */
export function raceWithTimeout<T>(
  promiseLike: PromiseLike<T>,
  ms: number,
  purpose: string,
): Promise<T> {
  const promise = Promise.resolve(promiseLike);
  let tid: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    tid = setTimeout(() => {
      reject(
        new Error(
          `${purpose}: keine Antwort nach ${Math.round(ms / 1000)}s — prüfe, ob Supabase läuft (\`npm run db:start\`) und die URL stimmt.`,
        ),
      );
    }, ms);
  });
  return Promise.race([promise, timeout]).finally(() => {
    if (tid !== undefined) clearTimeout(tid);
  });
}
