import type { jsPDF } from "jspdf";

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(ua);
}

function isFirefox(): boolean {
  return typeof navigator !== "undefined" && /Firefox/i.test(navigator.userAgent);
}

/** iPhone, iPod, iPad (inkl. iPadOS mit Desktop-UA). */
function isIosTouchDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function needsLandscapePrintFrame(): boolean {
  return isSafari() || isFirefox();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function scheduleBlobRevoke(url: string, delayMs = 120_000): void {
  window.setTimeout(() => URL.revokeObjectURL(url), delayMs);
}

/**
 * PDF in iframe laden — Handler vor `src` setzen (sonst verpasstes onload → Timeout).
 * Safari/Firefox feuern bei PDF-iframes oft kein onload → nach kurzer Wartezeit trotzdem drucken.
 */
function loadPdfInFrame(
  frame: HTMLIFrameElement,
  url: string,
  allowLoadTimeout: boolean,
): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };

    const fail = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      reject(new Error("print_pdf_load_failed"));
    };

    const timeout = window.setTimeout(() => {
      if (allowLoadTimeout) {
        finish();
        return;
      }
      fail();
    }, allowLoadTimeout ? 4_000 : 15_000);

    frame.onload = finish;
    frame.onerror = fail;
    frame.src = url;
  });
}

function applyPrintFrameStyles(frame: HTMLIFrameElement, landscape: boolean): void {
  if (landscape) {
    // Querformat-Viewport — schmales Portrait-Iframe (1×100px) erzwingte Hochformat in Safari.
    frame.style.cssText =
      "position:fixed;left:0;top:0;width:297mm;height:210mm;max-width:100vw;max-height:70vh;opacity:0.01;border:0;pointer-events:none;z-index:-1;";
  } else {
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  }
}

/**
 * iOS rendert PDF-iframes als Einzelbild — Querformat geht nur über den nativen PDF-Viewer.
 */
async function printPdfInNewWindow(url: string): Promise<void> {
  const printWin = window.open(url, "_blank", "noopener,noreferrer");
  if (!printWin) {
    throw new Error("print_popup_blocked");
  }

  await wait(900);
  printWin.focus();
  printWin.print();
  scheduleBlobRevoke(url);
}

/**
 * Druckt ein jsPDF-Dokument — Querformat bleibt auf iOS/Safari erhalten
 * (HTML `@page size` wird dort oft ignoriert).
 */
export async function printJsPdfDocument(doc: jsPDF): Promise<void> {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);

  if (isIosTouchDevice()) {
    try {
      await printPdfInNewWindow(url);
      return;
    } catch {
      // Popup blockiert → Landscape-Iframe als Fallback
    }
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  const landscapeFrame = needsLandscapePrintFrame();
  applyPrintFrameStyles(frame, landscapeFrame);

  const cleanup = () => {
    URL.revokeObjectURL(url);
    window.setTimeout(() => frame.remove(), 1_500);
  };

  const delayedCleanup = () => {
    scheduleBlobRevoke(url);
    window.setTimeout(() => frame.remove(), 1_500);
  };

  try {
    document.body.appendChild(frame);
    await loadPdfInFrame(frame, url, landscapeFrame);
    await wait(landscapeFrame ? 600 : 150);

    const win = frame.contentWindow;
    if (!win) {
      throw new Error("print_frame_unavailable");
    }

    win.focus();
    win.print();

    if (landscapeFrame) {
      delayedCleanup();
    } else {
      cleanup();
    }
  } catch (error) {
    cleanup();
    throw error;
  }
}
