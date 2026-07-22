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
  var HEIGHT_IGNORE_DELTA_PX = 6;
  var HEIGHT_SNAP_DELTA_PX = 24;
  var HOST_RESIZE_DEBOUNCE = 40;
  var HOST_FEED_RESIZE_DEBOUNCE = 200;
  var FEED_WIDGETS = {
    news: true,
    events: true,
    gallery: true,
    reviews: true,
  };
  var ALLOWED_ORIGINS = {
    "https://gwada.app": true,
    "https://new.gwada.app": true,
  };
  var pendingByFrame = typeof WeakMap !== "undefined" ? new WeakMap() : null;
  var timersByFrame = typeof WeakMap !== "undefined" ? new WeakMap() : null;

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

  function isFeedFrame(frame, data) {
    var key = (
      (frame && frame.getAttribute("data-gwada-widget")) ||
      (data && data.widget) ||
      ""
    ).toLowerCase();
    return Boolean(FEED_WIDGETS[key]);
  }

  function findIframeBySource(source) {
    if (!source) return null;
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
  }

  function applyHeight(frame, height, isFeed) {
    var prev = frame.dataset.gwadaHeight
      ? parseInt(frame.dataset.gwadaHeight, 10)
      : 0;
    if (prev === height) return;
    if (prev > 0 && Math.abs(height - prev) < HEIGHT_IGNORE_DELTA_PX) return;
    var isFirst = prev <= 0;
    var smallDelta = prev > 0 && Math.abs(height - prev) <= HEIGHT_SNAP_DELTA_PX;
    var snap =
      isFeed || isFirst || smallDelta || prefersReducedMotion();
    frame.style.transition = snap ? "none" : HEIGHT_TRANSITION;
    frame.style.height = height + "px";
    frame.style.minHeight = "0";
    frame.dataset.gwadaHeight = String(height);
  }

  function scheduleHeight(frame, height, isFeed) {
    if (!pendingByFrame || !timersByFrame) {
      applyHeight(frame, height, isFeed);
      return;
    }
    pendingByFrame.set(frame, height);
    var isFirst = !frame.dataset.gwadaHeight;
    if (isFirst) {
      var existing = timersByFrame.get(frame);
      if (existing) clearTimeout(existing);
      timersByFrame.delete(frame);
      applyHeight(frame, height, isFeed);
      pendingByFrame.delete(frame);
      return;
    }
    var prevTimer = timersByFrame.get(frame);
    if (prevTimer) clearTimeout(prevTimer);
    var ms = isFeed ? HOST_FEED_RESIZE_DEBOUNCE : HOST_RESIZE_DEBOUNCE;
    timersByFrame.set(
      frame,
      setTimeout(function () {
        var next = pendingByFrame.get(frame);
        pendingByFrame.delete(frame);
        timersByFrame.delete(frame);
        if (typeof next === "number") applyHeight(frame, next, isFeed);
      }, ms),
    );
  }

  function onMessage(event) {
    if (!ALLOWED_ORIGINS[event.origin]) return;
    var height = parseHeight(event.data);
    if (height == null) return;
    var frame = findIframeBySource(event.source);
    if (!frame) return;
    scheduleHeight(frame, height, isFeedFrame(frame, event.data));
  }

  global.addEventListener("message", onMessage);
})(typeof window !== "undefined" ? window : globalThis);
