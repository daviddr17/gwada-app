type UploadListener = (active: boolean) => void;

let activeUploadCount = 0;
const listeners = new Set<UploadListener>();

function notifyUploadActive() {
  const active = activeUploadCount > 0;
  for (const listener of listeners) {
    listener(active);
  }
}

export function subscribeDashboardUploadActive(listener: UploadListener): () => void {
  listeners.add(listener);
  listener(activeUploadCount > 0);
  return () => {
    listeners.delete(listener);
  };
}

export async function withDashboardUploadTracking<T>(
  task: () => Promise<T>,
): Promise<T> {
  activeUploadCount += 1;
  notifyUploadActive();
  try {
    return await task();
  } finally {
    activeUploadCount = Math.max(0, activeUploadCount - 1);
    notifyUploadActive();
  }
}
