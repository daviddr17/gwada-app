import type { jsPDF } from "jspdf";

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(ua);
}

function isFirefox(): boolean {
  return typeof navigator !== "undefined" && /Firefox/i.test(navigator.userAgent);
}

function needsVisiblePdfFrame(): boolean {
  return isSafari() || isFirefox();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function onceIframeLoaded(frame: HTMLIFrameElement): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      reject(new Error("print_pdf_load_timeout"));
    }, 15_000);

    const finish = () => {
      window.clearTimeout(timeout);
      resolve();
    };

    const fail = () => {
      window.clearTimeout(timeout);
      reject(new Error("print_pdf_load_failed"));
    };

    try {
      if (frame.contentDocument?.readyState === "complete") {
        finish();
        return;
      }
    } catch {
      // Cross-origin PDF viewer — rely on onload.
    }

    frame.onload = finish;
    frame.onerror = fail;
  });
}

/**
 * Druckt ein jsPDF-Dokument — Querformat bleibt auf iOS/Safari erhalten
 * (HTML `@page size` wird dort oft ignoriert).
 */
let printInFlight = false;

export async function printJsPdfDocument(doc: jsPDF): Promise<void> {
  if (printInFlight) return;
  printInFlight = true;

  let url: string | null = null;
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");

  const visibleFrame = needsVisiblePdfFrame();
  if (visibleFrame) {
    // Safari/Firefox rendern PDF in 0×0-iframes oft nicht → leerer Druck.
    frame.style.cssText =
      "position:fixed;left:0;top:0;width:1px;height:100px;opacity:0;border:0;pointer-events:none;";
  } else {
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  }

  const cleanup = () => {
    if (url) {
      URL.revokeObjectURL(url);
      url = null;
    }
    window.setTimeout(() => frame.remove(), 500);
  };

  const scheduleCleanup = () => {
    const win = frame.contentWindow;
    if (win) {
      const onAfterPrint = () => {
        win.removeEventListener("afterprint", onAfterPrint);
        cleanup();
      };
      win.addEventListener("afterprint", onAfterPrint);
    }
    // afterprint fehlt oft auf iOS — Blob erst später freigeben.
    window.setTimeout(cleanup, 120_000);
  };

  try {
    document.body.appendChild(frame);

    if (visibleFrame) {
      // Safari: Blob-URLs in iframes sind fehleranfällig (leerer Druck).
      frame.src = doc.output("datauristring");
    } else {
      const blob = doc.output("blob");
      url = URL.createObjectURL(blob);
      frame.src = url;
    }

    await onceIframeLoaded(frame);
    await wait(visibleFrame ? 1000 : 200);

    const win = frame.contentWindow;
    if (!win) {
      cleanup();
      throw new Error("print_frame_unavailable");
    }

    win.focus();
    win.print();
    scheduleCleanup();
  } catch (error) {
    cleanup();
    throw error;
  } finally {
    printInFlight = false;
  }
}
