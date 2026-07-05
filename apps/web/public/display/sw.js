/* Gwada Display PWA — Scope /display/ only. Bump DISPLAY_PWA_SW_VERSION on breaking changes. */
const DISPLAY_PWA_SW_VERSION = "display-pwa-v2";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
