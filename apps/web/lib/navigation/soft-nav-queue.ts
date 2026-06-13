"use client";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

let chain: Promise<void> = Promise.resolve();
let queueDepth = 0;

/** Parallele Modul-Wechsel vermeiden — ein RSC-Flight nach dem anderen. */
export function enqueueAppSoftNav(task: () => Promise<void>): void {
  queueDepth += 1;
  chain = chain
    .then(task)
    .catch(() => {})
    .finally(() => {
      queueDepth = Math.max(0, queueDepth - 1);
    });
}

export function isAppSoftNavQueueBusy(): boolean {
  return queueDepth > 0;
}

export function waitForAppPath(targetPath: string, timeoutMs = 8000): Promise<boolean> {
  const target = normalizePath(targetPath.split("?")[0] ?? targetPath);

  return new Promise((resolve) => {
    const startedAt = Date.now();

    const tick = () => {
      const current = normalizePath(window.location.pathname);
      if (current === target && !document.body.innerText.includes("couldn't load")) {
        resolve(true);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        resolve(false);
        return;
      }
      requestAnimationFrame(tick);
    };

    tick();
  });
}
