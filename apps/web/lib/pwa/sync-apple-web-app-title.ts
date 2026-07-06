/** Setzt den iOS Home-Bildschirm-Namen (Add-to-Home Prefill). */
export function syncAppleWebAppTitle(title: string): void {
  if (typeof document === "undefined") return;
  let meta = document.querySelector<HTMLMetaElement>(
    'meta[name="apple-mobile-web-app-title"]',
  );
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "apple-mobile-web-app-title";
    document.head.appendChild(meta);
  }
  if (meta.content !== title) {
    meta.content = title;
  }
}
