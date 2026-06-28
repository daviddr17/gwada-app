import {
  businessCardFormatById,
  type BusinessCardFormatId,
} from "@/lib/restaurant/business-card-design";
import {
  businessCardFontFamilyForCanvasExport,
  isCanvasUnsafeFontFamily,
  type BusinessCardTypographyId,
} from "@/lib/restaurant/business-card-typography";

/** ~300 DPI für 85 mm Breite → 1004 px; 20 px/mm ≈ 1700 px. */
export const BUSINESS_CARD_EXPORT_PX_PER_MM = 20;

export function businessCardExportWidthPx(formatId: BusinessCardFormatId): number {
  return businessCardFormatById(formatId).widthMm * BUSINESS_CARD_EXPORT_PX_PER_MM;
}

export function businessCardExportHeightPx(formatId: BusinessCardFormatId): number {
  return businessCardFormatById(formatId).heightMm * BUSINESS_CARD_EXPORT_PX_PER_MM;
}

async function waitForImages(container: HTMLElement): Promise<void> {
  if (typeof document !== "undefined" && document.fonts?.ready) {
    await document.fonts.ready.catch(() => undefined);
  }

  const imgs = [...container.querySelectorAll("img")];
  await Promise.all(imgs.map((img) => waitForImageElement(img)));
}

async function waitForImageElement(img: HTMLImageElement): Promise<void> {
  await new Promise<void>((resolve) => {
    if (img.complete && img.naturalWidth > 0) {
      resolve();
      return;
    }
    img.onload = () => resolve();
    img.onerror = () => resolve();
  });
  await img.decode().catch(() => undefined);
}

function waitFrames(count: number): Promise<void> {
  return new Promise((resolve) => {
    let remaining = count;
    const step = () => {
      remaining -= 1;
      if (remaining <= 0) resolve();
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

function isSameOriginUrl(url: string): boolean {
  if (url.startsWith("/")) return true;
  if (typeof window === "undefined") return false;
  try {
    return new URL(url, window.location.origin).origin === window.location.origin;
  } catch {
    return false;
  }
}

export async function urlToDataUrl(url: string | null | undefined): Promise<string | null> {
  if (!url?.trim()) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url, {
      credentials: isSameOriginUrl(url) ? "same-origin" : "omit",
      mode: "cors",
    });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (!blob.size) return null;
    return await blobToDataUrl(blob);
  } catch {
    return null;
  }
}

async function imageSrcToDataUrl(src: string): Promise<string | null> {
  if (src.startsWith("data:")) return src;
  if (src.startsWith("blob:")) {
    try {
      const res = await fetch(src);
      if (!res.ok) return null;
      const blob = await res.blob();
      if (!blob.size) return null;
      return await blobToDataUrl(blob);
    } catch {
      return null;
    }
  }
  return urlToDataUrl(src);
}

/** Ersetzt verbleibende Remote-<img>-Quellen durch Data-URLs (Canvas darf nicht „tainted“ sein). */
export async function inlineRemoteImagesForCanvasExport(
  container: HTMLElement,
): Promise<void> {
  const imgs = [...container.querySelectorAll("img")];
  await Promise.all(
    imgs.map(async (img) => {
      const src = (img.currentSrc || img.getAttribute("src"))?.trim();
      if (!src || src.startsWith("data:")) return;

      const absoluteSrc =
        src.startsWith("/") && typeof window !== "undefined"
          ? new URL(src, window.location.origin).href
          : src;

      const dataUrl = await imageSrcToDataUrl(absoluteSrc);
      if (dataUrl) {
        img.src = dataUrl;
        img.removeAttribute("crossorigin");
        img.removeAttribute("srcset");
        await waitForImageElement(img);
      } else {
        img.removeAttribute("src");
        img.removeAttribute("srcset");
      }
    }),
  );
}

function applyCanvasSafeFonts(
  root: HTMLElement,
  typographyId: BusinessCardTypographyId,
): void {
  const headingFamily = businessCardFontFamilyForCanvasExport(typographyId, "heading");
  const bodyFamily = businessCardFontFamilyForCanvasExport(typographyId, "body");

  for (const node of root.querySelectorAll("*")) {
    if (!(node instanceof HTMLElement)) continue;
    const inlineFamily = node.style.fontFamily;
    if (!inlineFamily) continue;
    node.style.fontFamily = isCanvasUnsafeFontFamily(inlineFamily)
      ? inlineFamily.includes("700") || inlineFamily.includes("600")
        ? headingFamily
        : bodyFamily
      : inlineFamily;
  }
}

function syncClonedImages(original: HTMLElement, clone: HTMLElement): void {
  const origImgs = [...original.querySelectorAll("img")];
  const cloneImgs = [...clone.querySelectorAll("img")];
  cloneImgs.forEach((img, index) => {
    const src = origImgs[index]?.currentSrc || origImgs[index]?.src;
    if (!src) {
      img.removeAttribute("src");
      return;
    }
    img.src = src;
    img.removeAttribute("crossorigin");
    img.removeAttribute("srcset");
  });
}

const CANVAS_INLINE_STYLE_PROPS = [
  "display",
  "position",
  "top",
  "left",
  "right",
  "bottom",
  "width",
  "height",
  "minWidth",
  "minHeight",
  "maxWidth",
  "maxHeight",
  "marginTop",
  "marginRight",
  "marginBottom",
  "marginLeft",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "borderTopColor",
  "borderRightColor",
  "borderBottomColor",
  "borderLeftColor",
  "borderTopStyle",
  "borderRightStyle",
  "borderBottomStyle",
  "borderLeftStyle",
  "borderRadius",
  "backgroundColor",
  "backgroundImage",
  "backgroundSize",
  "backgroundPosition",
  "backgroundRepeat",
  "color",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "lineHeight",
  "letterSpacing",
  "textAlign",
  "textTransform",
  "textDecorationLine",
  "whiteSpace",
  "overflow",
  "opacity",
  "zIndex",
  "visibility",
  "flexDirection",
  "flexWrap",
  "alignItems",
  "justifyContent",
  "alignContent",
  "flex",
  "flexGrow",
  "flexShrink",
  "flexBasis",
  "gridTemplateColumns",
  "gridTemplateRows",
  "columnGap",
  "rowGap",
  "gap",
  "objectFit",
  "objectPosition",
  "boxSizing",
  "boxShadow",
  "transform",
  "transformOrigin",
  "aspectRatio",
  "verticalAlign",
  "justifyItems",
  "alignSelf",
  "gridColumn",
  "gridRow",
  "pointerEvents",
] as const satisfies readonly (keyof CSSStyleDeclaration)[];

function cssPropertyKebab(prop: string): string {
  return prop.replace(/([A-Z])/g, (match) => `-${match.toLowerCase()}`);
}

function sanitizeBackgroundImageForCanvas(value: string): string {
  if (!value || value === "none") return value;
  if (value.includes("gradient(")) return value;
  if (value.includes("data:")) return value;
  return "none";
}

/** Stylesheets im Klon entfernen, Layout als Inline-Styles vom Original übernehmen. */
function inlineResolvedStylesForCanvasClone(
  originalRoot: HTMLElement,
  cloneRoot: HTMLElement,
  typographyId: BusinessCardTypographyId,
): void {
  const bodyFont = businessCardFontFamilyForCanvasExport(typographyId, "body");
  const headingFont = businessCardFontFamilyForCanvasExport(typographyId, "heading");

  const origNodes = [originalRoot, ...originalRoot.querySelectorAll("*")];
  const cloneNodes = [cloneRoot, ...cloneRoot.querySelectorAll("*")];

  for (let index = 0; index < origNodes.length; index += 1) {
    const orig = origNodes[index];
    const clone = cloneNodes[index];
    if (!(orig instanceof HTMLElement) || !(clone instanceof HTMLElement)) continue;

    clone.className = "";
    clone.removeAttribute("class");

    const computed = window.getComputedStyle(orig);
    for (const prop of CANVAS_INLINE_STYLE_PROPS) {
      let value = computed[prop];
      if (typeof value !== "string" || !value) continue;
      if (prop === "backgroundImage") {
        value = sanitizeBackgroundImageForCanvas(value);
      }
      try {
        clone.style.setProperty(cssPropertyKebab(prop), value);
      } catch {
        // Einzelne exotische Werte ignorieren.
      }
    }

    if (orig instanceof HTMLImageElement && clone instanceof HTMLImageElement) {
      clone.style.filter = "none";
      const width = computed.width;
      const height = computed.height;
      if (width && width !== "auto") {
        clone.style.width = width;
        clone.style.maxWidth = width;
      }
      if (height && height !== "auto") {
        clone.style.height = height;
        clone.style.maxHeight = height;
      }
      clone.style.objectFit = computed.objectFit || "contain";
      clone.style.aspectRatio = "auto";
    }

    const lineClamp = computed.getPropertyValue("-webkit-line-clamp");
    if (lineClamp && lineClamp !== "none") {
      clone.style.setProperty("-webkit-line-clamp", lineClamp);
      clone.style.setProperty(
        "-webkit-box-orient",
        computed.getPropertyValue("-webkit-box-orient"),
      );
      clone.style.display = "-webkit-box";
      clone.style.overflow = "hidden";
    }

    const fontWeight = Number.parseInt(computed.fontWeight, 10);
    const hasDirectText = [...orig.childNodes].some(
      (node) => node.nodeType === Node.TEXT_NODE && Boolean(node.textContent?.trim()),
    );
    if (hasDirectText || orig.style.fontFamily || computed.fontSize !== "16px") {
      clone.style.fontFamily = fontWeight >= 600 ? headingFont : bodyFont;
    }
  }
}

function assertCanvasSafeForExport(container: HTMLElement): void {
  for (const img of container.querySelectorAll("img")) {
    const src = img.currentSrc || img.src;
    if (!src) continue;
    if (!src.startsWith("data:")) {
      throw new Error(`export_unsafe_image_src: ${src.slice(0, 160)}`);
    }
  }

  for (const node of container.querySelectorAll("*")) {
    if (!(node instanceof HTMLElement)) continue;
    const inlineFamily = node.style.fontFamily;
    if (inlineFamily && isCanvasUnsafeFontFamily(inlineFamily)) {
      throw new Error(`export_unsafe_font: ${inlineFamily.slice(0, 120)}`);
    }
  }
}

async function captureFaceElement(
  el: HTMLElement,
  formatId: BusinessCardFormatId,
  typographyId: BusinessCardTypographyId,
): Promise<string> {
  const html2canvas = (await import("html2canvas-pro")).default;
  const widthPx = businessCardExportWidthPx(formatId);
  const heightPx = businessCardExportHeightPx(formatId);

  if (el.offsetWidth !== widthPx || el.offsetHeight !== heightPx) {
    throw new Error(
      `export_size_mismatch: expected ${widthPx}x${heightPx}, got ${el.offsetWidth}x${el.offsetHeight}`,
    );
  }

  await inlineRemoteImagesForCanvasExport(el);
  applyCanvasSafeFonts(el, typographyId);
  await waitForImages(el);
  assertCanvasSafeForExport(el);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = [
    "position:fixed",
    "left:-10000px",
    "top:0",
    `width:${widthPx}px`,
    `height:${heightPx}px`,
    "border:0",
    "opacity:0",
    "pointer-events:none",
  ].join(";");
  document.body.appendChild(iframe);

  try {
    const frameDoc = iframe.contentDocument;
    if (!frameDoc) {
      throw new Error("export_iframe_unavailable");
    }

    frameDoc.open();
    frameDoc.write(
      '<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="margin:0;padding:0;background:transparent"></body></html>',
    );
    frameDoc.close();

    const isolatedRoot = el.cloneNode(true) as HTMLElement;
    syncClonedImages(el, isolatedRoot);
    frameDoc.body.appendChild(isolatedRoot);
    inlineResolvedStylesForCanvasClone(el, isolatedRoot, typographyId);
    isolatedRoot.style.width = `${widthPx}px`;
    isolatedRoot.style.height = `${heightPx}px`;
    isolatedRoot.style.overflow = "hidden";
    isolatedRoot.style.position = "relative";
    await waitForImages(isolatedRoot);
    assertCanvasSafeForExport(isolatedRoot);

    const canvas = await html2canvas(isolatedRoot, {
      width: widthPx,
      height: heightPx,
      scale: 1,
      useCORS: true,
      allowTaint: false,
      logging: false,
      backgroundColor: null,
      imageTimeout: 20_000,
      foreignObjectRendering: false,
    });

    if (canvas.width <= 0 || canvas.height <= 0) {
      throw new Error("html2canvas_zero_canvas");
    }

    try {
      return canvas.toDataURL("image/png");
    } catch (error) {
      throw new Error(
        `canvas_to_data_url_failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  } finally {
    iframe.remove();
  }
}

export async function captureBusinessCardFaces(
  frontEl: HTMLElement,
  backEl: HTMLElement,
  formatId: BusinessCardFormatId,
  typographyId: BusinessCardTypographyId,
): Promise<{ front: string; back: string }> {
  await document.fonts.ready;
  await waitForImages(frontEl);
  await waitForImages(backEl);
  await waitFrames(3);

  const front = await captureFaceElement(frontEl, formatId, typographyId);
  await waitForImages(backEl);
  const back = await captureFaceElement(backEl, formatId, typographyId);

  return { front, back };
}

export async function buildBusinessCardPdfFromImages(
  frontDataUrl: string,
  backDataUrl: string,
  formatId: BusinessCardFormatId,
): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const format = businessCardFormatById(formatId);
  const orientation = format.widthMm >= format.heightMm ? "landscape" : "portrait";
  const pageFormat: [number, number] = [format.widthMm, format.heightMm];

  const doc = new jsPDF({
    orientation,
    unit: "mm",
    format: pageFormat,
    compress: true,
  });

  const imageFormat = frontDataUrl.startsWith("data:image/png") ? "PNG" : "JPEG";

  doc.addImage(frontDataUrl, imageFormat, 0, 0, format.widthMm, format.heightMm);
  doc.addPage(pageFormat, orientation);
  doc.addImage(backDataUrl, imageFormat, 0, 0, format.widthMm, format.heightMm);

  const blob = doc.output("blob");
  if (!(blob instanceof Blob) || blob.size === 0) {
    throw new Error("jspdf_empty_blob");
  }
  return blob;
}

export { waitForImages, waitFrames };
