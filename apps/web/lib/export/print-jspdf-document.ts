import type { jsPDF } from "jspdf";

/**
 * Druckt ein jsPDF-Dokument — Querformat bleibt auf iOS/Safari erhalten
 * (HTML `@page size` wird dort oft ignoriert).
 */
export function printJsPdfDocument(doc: jsPDF): Promise<void> {
  return new Promise((resolve, reject) => {
    let url: string | null = null;
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";

    const cleanup = () => {
      if (url) URL.revokeObjectURL(url);
      window.setTimeout(() => frame.remove(), 1500);
    };

    frame.onload = () => {
      try {
        const win = frame.contentWindow;
        if (!win) {
          cleanup();
          reject(new Error("print_frame_unavailable"));
          return;
        }
        win.focus();
        win.print();
        cleanup();
        resolve();
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    frame.onerror = () => {
      cleanup();
      reject(new Error("print_pdf_load_failed"));
    };

    try {
      const blob = doc.output("blob");
      url = URL.createObjectURL(blob);
      document.body.appendChild(frame);
      frame.src = url;
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
