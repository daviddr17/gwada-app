/** Ops-Session-Prefs (Workstation) — localStorage, kein DB-Roundtrip. */

const STORAGE_KEY = "gwada:ops-session-prefs:v1";

export type OpsSessionPrefs = {
  /** Keine Live-Toasts — Feed + Glocke bleiben. */
  quietMode: boolean;
};

const DEFAULTS: OpsSessionPrefs = {
  quietMode: false,
};

type Listener = () => void;

let cached: OpsSessionPrefs | null = null;
const listeners = new Set<Listener>();

function read(): OpsSessionPrefs {
  if (cached) return cached;
  if (typeof window === "undefined") return { ...DEFAULTS };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      cached = { ...DEFAULTS };
      return cached;
    }
    const parsed = JSON.parse(raw) as Partial<OpsSessionPrefs>;
    cached = {
      quietMode: Boolean(parsed.quietMode),
    };
    return cached;
  } catch {
    cached = { ...DEFAULTS };
    return cached;
  }
}

function write(next: OpsSessionPrefs) {
  cached = next;
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      /* ignore */
    }
  }
  for (const listener of listeners) listener();
}

export function getOpsSessionPrefs(): OpsSessionPrefs {
  return read();
}

export function isOpsQuietMode(): boolean {
  return read().quietMode;
}

export function setOpsQuietMode(quietMode: boolean) {
  write({ ...read(), quietMode });
}

export function toggleOpsQuietMode(): boolean {
  const next = !read().quietMode;
  setOpsQuietMode(next);
  return next;
}

export function subscribeOpsSessionPrefs(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
