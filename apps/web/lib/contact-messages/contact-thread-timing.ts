import "server-only";

export type ContactThreadTimingEntry = {
  source: string;
  ms: number;
  fetched?: number;
  returned?: number;
  apiLimit?: number;
};

export type ContactThreadTiming = {
  totalMs: number;
  pageLimit: number;
  before: string | null;
  contactId: string;
  entries: ContactThreadTimingEntry[];
};

export function createContactThreadTiming(params: {
  contactId: string;
  pageLimit: number;
  before?: string | null;
}): {
  timing: ContactThreadTiming;
  mark: (
    source: string,
    ms: number,
    extra?: Omit<ContactThreadTimingEntry, "source" | "ms">,
  ) => void;
  finish: () => ContactThreadTiming;
} {
  const started = performance.now();
  const timing: ContactThreadTiming = {
    totalMs: 0,
    pageLimit: params.pageLimit,
    before: params.before ?? null,
    contactId: params.contactId,
    entries: [],
  };

  return {
    timing,
    mark(source, ms, extra) {
      timing.entries.push({ source, ms, ...extra });
    },
    finish() {
      timing.totalMs = Math.round(performance.now() - started);
      return timing;
    },
  };
}

export function logContactThreadTiming(timing: ContactThreadTiming): void {
  console.info("[contact-thread]", JSON.stringify(timing));
}
