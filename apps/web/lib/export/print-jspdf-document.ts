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

/**
 * Druckt ein jsPDF-Dokument — Querformat bleibt auf iOS/Safari erhalten
 * (HTML `@page size` wird dort oft ignoriert).
 */
export async function printJsPdfDocument(doc: jsPDF): Promise<void> {
  const blob = doc.output("blob");
  const url = URL.createObjectURL(blob);
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
    URL.revokeObjectURL(url);
    window.setTimeout(() => frame.remove(), 1_500);
  };

  try {
    document.body.appendChild(frame);
    await loadPdfInFrame(frame, url, visibleFrame);
    await wait(visibleFrame ? 600 : 150);

    const win = frame.contentWindow;
    if (!win) {
      throw new Error("print_frame_unavailable");
    }

    win.focus();
    win.print();
    cleanup();
  } catch (error) {
    cleanup();
    throw error;
  }
}
