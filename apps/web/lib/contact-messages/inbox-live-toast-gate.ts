"use client";

let suppressedByOpenThread = false;

/** Unterdrückt „Neue Nachricht“-Toasts, solange ein Chat-Thread offen ist. */
export function setInboxLiveToastSuppressedByOpenThread(suppressed: boolean): void {
  suppressedByOpenThread = suppressed;
}

export function isInboxLiveToastSuppressedByOpenThread(): boolean {
  return suppressedByOpenThread;
}
