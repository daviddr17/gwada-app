import "server-only";

const DEFAULT_MS = 8_000;

export async function fetchWithTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  timeoutMs = DEFAULT_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((resolve) => {
        timer = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
