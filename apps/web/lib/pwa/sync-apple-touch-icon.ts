/** Erzwingt das PWA-Icon für iOS Launch / Add-to-Home (überschreibt Root-Favicon). */
export function syncAppleTouchIcon(href: string): void {
  if (typeof document === "undefined") return;
  let link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "apple-touch-icon";
    document.head.appendChild(link);
  }
  link.href = href;
  link.sizes = "180x180";
  link.type = "image/png";
}
