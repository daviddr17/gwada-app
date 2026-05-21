/** UUID — `crypto.randomUUID` nur in Secure Context (HTTPS/localhost); Live-VPS ist oft HTTP. */
export function createId(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  return `gwada-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
