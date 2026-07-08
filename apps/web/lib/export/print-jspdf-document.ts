import type { jsPDF } from "jspdf";
import {
  isEmbeddedPrintHost,
  isIosTouchDevice,
  shouldAutoTriggerPrintDialog,
  type PrintJsPdfResult,
} from "@/lib/export/print-host";

export type { PrintJsPdfResult } from "@/lib/export/print-host";

export type PrintJsPdfDocumentOptions = {
  /** Dateiname für iOS Share-Sheet (Querformat-PDF). */
  shareFilename?: string;
  /** HTML-Tabellen-Fallback auf iOS, wenn Share/iframe scheitern. */
  htmlFallback?: {
    documentTitle: string;
    headers: readonly string[];
    rows: string[][];
    restaurantName?: string;
    summaryLine?: string;
  };
};

function isSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  return /AppleWebKit/i.test(ua) && !/Chrome|CriOS|Chromium|Edg|OPR|FxiOS/i.test(ua);
}

function isFirefox(): boolean {
  return typeof navigator !== "undefined" && /Firefox/i.test(navigator.userAgent);
}

function needsLandscapePrintFrame(): boolean {
  return isSafari() || isFirefox();
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function scheduleBlobRevoke(url: string, delayMs = 180_000): void {
  window.setTimeout(() => URL.revokeObjectURL(url), delayMs);
}

/**
 * PDF in iframe laden — Handler vor `src` setzen (sonst verpasstes onload → Timeout).
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
    }, allowLoadTimeout ? 5_000 : 15_000);

    frame.onload = finish;
    frame.onerror = fail;
    frame.src = url;
  });
}

function applyPrintFrameStyles(frame: HTMLIFrameElement, landscape: boolean): void {
  if (landscape) {
    frame.style.cssText =
      "position:fixed;left:0;top:0;width:1122px;height:793px;max-width:100vw;max-height:100vh;opacity:0.01;border:0;pointer-events:none;z-index:-1;";
  } else {
    frame.style.cssText =
      "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  }
}

function openPdfInNewTab(url: string): void {
  const printWin = window.open(url, "_blank", "noopener,noreferrer");
  if (!printWin) {
    throw new Error("print_popup_blocked");
  }
  scheduleBlobRevoke(url);
}

async function trySharePdfOnIos(blob: Blob, filename: string): Promise<boolean> {
  if (!isIosTouchDevice() || typeof navigator.share !== "function") {
    return false;
  }

  const file = new File([blob], filename, { type: "application/pdf" });
  const shareData = { files: [file] };
  if (!navigator.canShare?.(shareData)) {
    return false;
  }

  try {
    await navigator.share(shareData);
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      return true;
    }
    return false;
  }
}

async function printPdfInIframe(url: string): Promise<PrintJsPdfResult> {
  if (isEmbeddedPrintHost()) {
    openPdfInNewTab(url);
    return "opened_tab";
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
    await wait(landscapeFrame ? (isIosTouchDevice() ? 1_800 : 600) : 150);

    const win = frame.contentWindow;
    if (!win) {
      throw new Error("print_frame_unavailable");
    }

    if (!shouldAutoTriggerPrintDialog()) {
      cleanup();
      openPdfInNewTab(url);
      return "opened_tab";
    }

    win.focus();
    win.print();

    if (landscapeFrame) {
      delayedCleanup();
    } else {
      cleanup();
    }
    return "printed";
  } catch (error) {
    cleanup();
    throw error;
  }
}

/**
 * Druckt ein jsPDF-Dokument — auf iPad zuerst Share→Drucken (Querformat-PDF),
 * sonst iframe; in IDE-Browsern nur PDF-Tab (kein programmatischer Print-Dialog).
 */
export async function printJsPdfDocument(
  doc: jsPDF,
  options?: PrintJsPdfDocumentOptions,
): Promise<PrintJsPdfResult> {
  const blob = doc.output("blob");
  const shareFilename = options?.shareFilename?.trim() || "dokument.pdf";

  const shared = await trySharePdfOnIos(blob, shareFilename);
  if (shared) return "shared";

  const url = URL.createObjectURL(blob);

  try {
    return await printPdfInIframe(url);
  } catch (error) {
    URL.revokeObjectURL(url);
    if (options?.htmlFallback) {
      const { printHtmlLandscapeDocument } = await import(
        "@/lib/export/print-html-landscape-document"
      );
      return printHtmlLandscapeDocument(options.htmlFallback);
    }
    throw error;
  }
}
