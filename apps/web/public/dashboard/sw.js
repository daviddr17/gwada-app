/* Gwada Dashboard PWA — Scope /dashboard/ only. Bump DASHBOARD_PWA_SW_VERSION on breaking changes. */
const DASHBOARD_PWA_SW_VERSION = "dashboard-pwa-v1";

self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
