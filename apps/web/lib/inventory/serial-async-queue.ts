/** Serialisiert async Tasks (z. B. Bestell-Persist) — verhindert Last-write-wins. */
export type SerialAsyncQueue = {
  readonly pendingCount: number;
  subscribe: (listener: () => void) => () => void;
  enqueue: <T>(task: () => Promise<T>) => Promise<T>;
};

export function createSerialAsyncQueue(): SerialAsyncQueue {
  let chain = Promise.resolve();
  let pending = 0;
  const listeners = new Set<() => void>();

  const notify = () => {
    for (const listener of listeners) {
      listener();
    }
  };

  return {
    get pendingCount() {
      return pending;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    enqueue(task) {
      pending += 1;
      notify();
      const run = chain.then(task, task);
      chain = run.then(
        () => undefined,
        () => undefined,
      );
      return run.finally(() => {
        pending -= 1;
        notify();
      });
    },
  };
}
