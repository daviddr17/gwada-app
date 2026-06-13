"use client";

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.slice(0, -1);
  }
  return pathname;
}

let chain: Promise<void> = Promise.resolve();

/** Parallele Modul-Wechsel vermeiden — ein RSC-Flight nach dem anderen. */
export function enqueueAppSoftNav(task: () => Promise<void>): void {
  chain = chain.then(task).catch(() => {});
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
