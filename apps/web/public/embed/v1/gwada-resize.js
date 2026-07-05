/**
 * Gwada Embed Resize Bridge — dynamische iframe-Höhe ohne vollen gwada.js-Loader.
 *
 * Für manuelle iframe-Einbindungen (ohne data-gwada-widget):
 *   <iframe src="https://gwada.app/embed/…" …></iframe>
 *   <script async src="https://gwada.app/embed/v1/gwada-resize.js"></script>
 */
(function (global) {
  "use strict";

  var MSG = "gwada:embed:resize";
  var MSG_LEGACY = "gwada-embed-resize";
  var HEIGHT_TRANSITION = "height 0.24s cubic-bezier(0.33, 1, 0.68, 1)";
  var ALLOWED_ORIGINS = {
    "https://gwada.app": true,
    "https://new.gwada.app": true,
  };

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function parseHeight(data) {
    if (!data || typeof data !== "object") return null;
    if (data.type !== MSG && data.type !== MSG_LEGACY) return null;
    var height = data.height;
    if (typeof height !== "number" || height <= 0) return null;
    return Math.ceil(height);
  }

  function findIframeBySource(source) {
    if (!source) return null;
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
  }

  function applyHeight(frame, height) {
    var prev = frame.dataset.gwadaHeight
      ? parseInt(frame.dataset.gwadaHeight, 10)
      : 0;
    if (prev === height) return;
    var isFirst = prev <= 0;
    frame.style.transition =
      isFirst || prefersReducedMotion() ? "none" : HEIGHT_TRANSITION;
    frame.style.height = height + "px";
    frame.style.minHeight = "0";
    frame.dataset.gwadaHeight = String(height);
  }

  function onMessage(event) {
    if (!ALLOWED_ORIGINS[event.origin]) return;
    var height = parseHeight(event.data);
    if (height == null) return;
    var frame = findIframeBySource(event.source);
    if (!frame) return;
    applyHeight(frame, height);
  }

  global.addEventListener("message", onMessage);
})(typeof window !== "undefined" ? window : globalThis);
