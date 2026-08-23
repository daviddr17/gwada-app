import { toast } from "sonner";
import { isOpsQuietMode } from "@/lib/ops/ops-session-prefs";

/** Live-Ops-Toasts: kurz, leise; Ruhe-Modus → nur Feed. */
export const OPS_LIVE_TOAST_DURATION_MS = 2_800;

type GroupState = {
  count: number;
  timer: number | null;
  toastId: string | number | null;
};

const groups = new Map<string, GroupState>();

function getGroup(key: string): GroupState {
  let g = groups.get(key);
  if (!g) {
    g = { count: 0, timer: null, toastId: null };
    groups.set(key, g);
  }
  return g;
}

/**
 * Zeigt einen Live-Toast — oder gruppiert Bursts (z. B. 3 Reservierungen).
 * Im Ruhe-Modus: kein Toast (Caller schreibt weiter in den Live-Verlauf).
 */
export function showOpsLiveToast(options: {
  groupKey: string;
  title: string;
  description?: string;
  /** Singular → Plural wenn count > 1 */
  titlePlural?: (count: number) => string;
}): void {
  if (typeof window === "undefined") return;
  if (isOpsQuietMode()) return;

  const group = getGroup(options.groupKey);
  group.count += 1;

  if (group.timer != null) {
    window.clearTimeout(group.timer);
  }

  group.timer = window.setTimeout(() => {
    const count = group.count;
    group.count = 0;
    group.timer = null;

    const title =
      count > 1 && options.titlePlural
        ? options.titlePlural(count)
        : options.title;

    const id = toast.info(title, {
      id: options.groupKey,
      description: count > 1 ? undefined : options.description,
      duration: OPS_LIVE_TOAST_DURATION_MS,
    });
    group.toastId = id;
  }, 450);
}
