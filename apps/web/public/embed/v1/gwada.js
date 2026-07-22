/**
 * Gwada Embed Loader v1 — ein Script für alle Widgets (Reservierung, Speisekarte, …).
 *
 * Host-Seite:
 *   <div data-gwada-widget="reservation" data-gwada-slug="mein-restaurant"></div>
 *   <script async src="https://gwada.app/embed/v1/gwada.js"></script>
 */
(function (global) {
  "use strict";

  var VERSION = 1;
  var MSG = "gwada:embed:resize";
  var MSG_SCROLL_TO = "gwada:embed:scroll-to";
  var MSG_FRAME_VIEWPORT = "gwada:embed:frame-viewport";
  var MSG_TOOLBAR_PIN = "gwada:embed:toolbar-pin";
  var MSG_LEGACY = "gwada-embed-resize";
  var PROCESSED = "data-gwada-processed";
  var LAZY_MARGIN = "240px";
  var HOST_RESIZE_DEBOUNCE = 40;
  /** News/Galerie: weniger Host-Layout-Thrash bei Bild-Nachladen. */
  var HOST_FEED_RESIZE_DEBOUNCE = 200;
  var HEIGHT_TRANSITION = "height 0.24s cubic-bezier(0.33, 1, 0.68, 1)";
  /** Deltas darunter ignorieren (Subpixel / Fonts). */
  var HEIGHT_IGNORE_DELTA_PX = 6;
  /** Kleine Höhen-Deltas ohne Transition (nur Nicht-Feed). */
  var HEIGHT_SNAP_DELTA_PX = 24;
  var BRAND_FOOTER_LOGO_PATH = "/api/platform/favicon";
  var BRAND_FOOTER_ATTR = "data-gwada-brand-footer";
  /** Tall content embeds — Höhe nie animieren (sonst reflowt die Host-Seite 240ms). */
  var FEED_WIDGETS = {
    news: true,
    events: true,
    gallery: true,
    reviews: true,
  };
  /** Nur Speisekarte braucht Scroll-Viewport (Toolbar-Pin). */
  var VIEWPORT_WIDGETS = {
    menu: true,
  };

  var WIDGETS = {
    reservation: {
      title: "Reservierung",
      minHeight: 420,
      path: function (slug) {
        return "/embed/reservieren/" + encodeURIComponent(slug);
      },
      available: true,
    },
    menu: {
      title: "Speisekarte",
      minHeight: 480,
      path: function (slug) {
        return "/embed/speisekarte/" + encodeURIComponent(slug);
      },
      available: true,
    },
    reviews: {
      title: "Bewertungen",
      minHeight: 520,
      path: function (slug) {
        return "/embed/bewertungen/" + encodeURIComponent(slug);
      },
      available: true,
    },
    news: {
      title: "News",
      minHeight: 520,
      path: function (slug) {
        return "/embed/news/" + encodeURIComponent(slug);
      },
      available: true,
    },
    events: {
      title: "Events",
      minHeight: 520,
      path: function (slug) {
        return "/embed/events/" + encodeURIComponent(slug);
      },
      available: true,
    },
    gallery: {
      title: "Galerie",
      minHeight: 520,
      path: function (slug) {
        return "/embed/gallery/" + encodeURIComponent(slug);
      },
      available: true,
    },
    opening_hours: {
      title: "Öffnungszeiten",
      minHeight: 420,
      path: function (slug) {
        return "/embed/oeffnungszeiten/" + encodeURIComponent(slug);
      },
      available: true,
    },
    contact: {
      title: "Kontakt",
      minHeight: 360,
      path: function (slug) {
        return "/embed/kontakt/" + encodeURIComponent(slug);
      },
      available: false,
    },
  };

  var embedOrigin = null;
  var CANONICAL_EMBED_ORIGIN = "https://gwada.app";
  var EMBED_ORIGIN_ALIASES = {
    "https://gwada.app": true,
    "https://new.gwada.app": true,
  };
  var iframesById = Object.create(null);
  var pendingHeights = Object.create(null);
  var heightTimers = Object.create(null);
  var viewportListenerAttached = false;
  var viewportRaf = 0;

  function normalizeEmbedOrigin(origin) {
    if (!origin) return null;
    if (EMBED_ORIGIN_ALIASES[origin]) return CANONICAL_EMBED_ORIGIN;
    return origin;
  }

  function isAllowedEmbedMessageOrigin(origin) {
    if (!origin || !embedOrigin) return false;
    if (origin === embedOrigin) return true;
    return Boolean(
      EMBED_ORIGIN_ALIASES[origin] && EMBED_ORIGIN_ALIASES[embedOrigin],
    );
  }

  function scriptOrigin() {
    var current = document.currentScript;
    if (current && current.src) {
      try {
        return normalizeEmbedOrigin(new URL(current.src).origin);
      } catch (_e) {}
    }
    var nodes = document.querySelectorAll('script[src*="/embed/v1/gwada.js"]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      try {
        return normalizeEmbedOrigin(new URL(nodes[i].src).origin);
      } catch (_e2) {}
    }
    return null;
  }

  function prefersReducedMotion() {
    return (
      global.matchMedia &&
      global.matchMedia("(prefers-reduced-motion: reduce)").matches
    );
  }

  function ensurePreconnect(origin) {
    if (!origin || document.getElementById("gwada-embed-preconnect")) return;
    var link = document.createElement("link");
    link.id = "gwada-embed-preconnect";
    link.rel = "preconnect";
    link.href = origin;
    document.head.appendChild(link);
  }

  function randomId() {
    return "gwada-embed-" + Math.random().toString(36).slice(2, 10);
  }

  function parseMinHeight(el, fallback) {
    var raw = el.getAttribute("data-gwada-min-height");
    if (!raw) return fallback;
    var n = parseInt(raw, 10);
    return n > 0 ? n : fallback;
  }

  function isLazyEnabled(el) {
    var v = (el.getAttribute("data-gwada-lazy") || "").trim().toLowerCase();
    return v !== "false" && v !== "0" && v !== "no";
  }

  function createIframe(el, widgetKey, slug, origin) {
    var def = WIDGETS[widgetKey];
    if (!def || !def.available) {
      el.setAttribute(PROCESSED, "unsupported");
      el.textContent = "Dieses Gwada-Widget ist noch nicht verfügbar.";
      return null;
    }

    var embedId = randomId();
    var minHeight = parseMinHeight(el, def.minHeight);
    var src =
      origin +
      def.path(slug) +
      "?gwada_embed_id=" +
      encodeURIComponent(embedId) +
      "&gwada_widget=" +
      encodeURIComponent(widgetKey);

    var frame = document.createElement("iframe");
    frame.id = embedId;
    frame.src = src;
    frame.title = def.title;
    frame.setAttribute("data-gwada-widget", widgetKey);
    frame.setAttribute("data-gwada-slug", slug);
    frame.loading = "lazy";
    frame.referrerPolicy = "strict-origin-when-cross-origin";
    frame.style.width = "100%";
    frame.style.border = "0";
    frame.style.display = "block";
    frame.style.background = "transparent";
    frame.style.minHeight = minHeight + "px";

    iframesById[embedId] = frame;
    if (frameNeedsViewport(frame)) ensureViewportScrollListeners();
    el.setAttribute(PROCESSED, "true");
    el.replaceChildren(frame);
    return frame;
  }

  function mountElement(el, origin) {
    if (el.getAttribute(PROCESSED)) return;
    ensurePreconnect(origin);

    var widgetKey = (el.getAttribute("data-gwada-widget") || "")
      .trim()
      .toLowerCase();
    var slug = (el.getAttribute("data-gwada-slug") || "").trim().toLowerCase();
    if (!widgetKey || !slug || !WIDGETS[widgetKey]) {
      el.setAttribute(PROCESSED, "invalid");
      return;
    }

    var mount = function () {
      var frame = createIframe(el, widgetKey, slug, origin);
      if (frame) appendBrandFooter(el, origin);
    };

    if (!isLazyEnabled(el) || !("IntersectionObserver" in global)) {
      mount();
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].isIntersecting) {
            observer.disconnect();
            mount();
            break;
          }
        }
      },
      { rootMargin: LAZY_MARGIN, threshold: 0.01 },
    );
    observer.observe(el);
  }

  function ensureBrandFooterStyles() {
    if (document.getElementById("gwada-embed-brand-footer-styles")) return;
    var style = document.createElement("style");
    style.id = "gwada-embed-brand-footer-styles";
    style.textContent =
      "[data-gwada-brand-footer]{display:flex;justify-content:center;padding:8px 16px 12px;margin:0}" +
      "[data-gwada-brand-footer] a{opacity:1;line-height:0;text-decoration:none;transition:opacity .15s ease}" +
      "[data-gwada-brand-footer] a:hover{opacity:.9}" +
      "[data-gwada-brand-footer] img{height:20px;width:auto;max-width:5.5rem;object-fit:contain;display:block}" +
      "[data-gwada-brand-footer] span{font:500 11px/1.2 system-ui,-apple-system,sans-serif;color:#737373;letter-spacing:-.01em}";
    document.head.appendChild(style);
  }

  function appendBrandFooter(container, origin) {
    if (!container || container.querySelector("[" + BRAND_FOOTER_ATTR + "]")) return;
    ensureBrandFooterStyles();

    var footer = document.createElement("div");
    footer.setAttribute(BRAND_FOOTER_ATTR, "true");

    var link = document.createElement("a");
    link.href = origin || "https://gwada.app";
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.setAttribute("aria-label", "gwada");

    var img = document.createElement("img");
    img.src = (origin || "") + BRAND_FOOTER_LOGO_PATH;
    img.alt = "gwada";
    img.loading = "lazy";
    img.decoding = "async";
    img.onerror = function () {
      if (link.contains(img)) link.removeChild(img);
      if (!link.querySelector("span")) {
        var label = document.createElement("span");
        label.textContent = "gwada";
        link.appendChild(label);
      }
    };

    link.appendChild(img);
    footer.appendChild(link);
    container.appendChild(footer);
  }

  function widgetKeyOf(frame) {
    if (!frame) return "";
    return (frame.getAttribute("data-gwada-widget") || "").toLowerCase();
  }

  function isFeedWidgetFrame(frame) {
    return Boolean(FEED_WIDGETS[widgetKeyOf(frame)]);
  }

  function frameNeedsViewport(frame) {
    return Boolean(VIEWPORT_WIDGETS[widgetKeyOf(frame)]);
  }

  function applyHeightToFrame(frame, height, immediate) {
    if (!frame || frame.tagName !== "IFRAME") return;
    var px = Math.ceil(height);
    if (px <= 0) return;

    var prev = frame.dataset.gwadaHeight
      ? parseInt(frame.dataset.gwadaHeight, 10)
      : 0;
    if (prev === px) return;
    if (prev > 0 && Math.abs(px - prev) < HEIGHT_IGNORE_DELTA_PX) return;

    var isFeed = isFeedWidgetFrame(frame);
    var isFirst = prev <= 0;
    // Feed/News: nie height transition — animierte iframe-Höhe reflowt die
    // gesamte Host-Seite unter dem Embed und fühlt sich wie „Hängen“ an.
    var smallDelta = prev > 0 && Math.abs(px - prev) <= HEIGHT_SNAP_DELTA_PX;
    var snap =
      isFeed ||
      immediate ||
      isFirst ||
      smallDelta ||
      prefersReducedMotion();
    frame.style.transition = snap ? "none" : HEIGHT_TRANSITION;
    frame.style.height = px + "px";
    frame.style.minHeight = "0";
    frame.dataset.gwadaHeight = String(px);
    if (frameNeedsViewport(frame)) postFrameViewport(frame);
  }

  function applyHeight(embedId, height, immediate) {
    var frame = embedId
      ? iframesById[embedId] || document.getElementById(embedId)
      : null;
    applyHeightToFrame(frame, height, immediate);
  }

  function findIframeByContentWindow(source) {
    if (!source) return null;
    for (var id in iframesById) {
      if (
        Object.prototype.hasOwnProperty.call(iframesById, id) &&
        iframesById[id].contentWindow === source
      ) {
        return iframesById[id];
      }
    }
    var frames = document.getElementsByTagName("iframe");
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === source) return frames[i];
    }
    return null;
  }

  function scheduleHeightFromEvent(event, height) {
    var data = event.data;
    if (data && data.embedId) {
      scheduleHeight(data.embedId, height);
      return;
    }
    var frame = findIframeByContentWindow(event.source);
    if (!frame) return;
    if (!frame.id) frame.id = randomId();
    if (!iframesById[frame.id]) iframesById[frame.id] = frame;
    scheduleHeight(frame.id, height);
  }

  function scheduleHeight(embedId, height) {
    if (!embedId) return;
    pendingHeights[embedId] = height;
    var frame = iframesById[embedId] || document.getElementById(embedId);
    var isFirst = frame && !frame.dataset.gwadaHeight;
    if (isFirst) {
      if (heightTimers[embedId]) {
        clearTimeout(heightTimers[embedId]);
        delete heightTimers[embedId];
      }
      applyHeight(embedId, height, true);
      delete pendingHeights[embedId];
      return;
    }
    if (heightTimers[embedId]) clearTimeout(heightTimers[embedId]);
    var debounceMs = isFeedWidgetFrame(frame)
      ? HOST_FEED_RESIZE_DEBOUNCE
      : HOST_RESIZE_DEBOUNCE;
    heightTimers[embedId] = setTimeout(function () {
      applyHeight(embedId, pendingHeights[embedId], false);
      delete pendingHeights[embedId];
      delete heightTimers[embedId];
    }, debounceMs);
  }

  function postFrameViewport(frame) {
    if (!frame || !frame.contentWindow || !embedOrigin) return;
    var rect = frame.getBoundingClientRect();
    frame.contentWindow.postMessage(
      {
        type: MSG_FRAME_VIEWPORT,
        version: VERSION,
        embedId: frame.id,
        top: rect.top,
        left: rect.left,
        width: rect.width,
        bottom: rect.bottom,
        pinTop: 0,
      },
      embedOrigin,
    );
  }

  function postMenuFrameViewports() {
    for (var id in iframesById) {
      if (!Object.prototype.hasOwnProperty.call(iframesById, id)) continue;
      var frame = iframesById[id];
      if (frameNeedsViewport(frame)) postFrameViewport(frame);
    }
  }

  /** Nur für Speisekarte (Toolbar-Pin). News/Stunden brauchen das nicht. */
  function onHostScrollOrResize() {
    if (viewportRaf) return;
    viewportRaf = global.requestAnimationFrame(function () {
      viewportRaf = 0;
      postMenuFrameViewports();
    });
  }

  function ensureViewportScrollListeners() {
    if (viewportListenerAttached) return;
    viewportListenerAttached = true;
    global.addEventListener("scroll", onHostScrollOrResize, { passive: true });
    global.addEventListener("resize", onHostScrollOrResize, { passive: true });
  }

  function onMessage(event) {
    if (!isAllowedEmbedMessageOrigin(event.origin)) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === MSG && data.version === VERSION) {
      scheduleHeightFromEvent(event, data.height);
      return;
    }

    if (data.type === MSG_LEGACY) {
      scheduleHeightFromEvent(event, data.height);
      return;
    }

    if (data.type === MSG_SCROLL_TO && data.version === VERSION) {
      var scrollFrame =
        iframesById[data.embedId] || document.getElementById(data.embedId);
      if (!scrollFrame || scrollFrame.tagName !== "IFRAME") return;
      var scrollRect = scrollFrame.getBoundingClientRect();
      var stickyH =
        typeof data.stickyHeight === "number" ? data.stickyHeight : 0;
      var absoluteTarget =
        global.scrollY +
        scrollRect.top +
        data.offsetTop -
        stickyH -
        8;
      global.scrollTo({
        top: absoluteTarget < 0 ? 0 : absoluteTarget,
        behavior: "smooth",
      });
      return;
    }

    if (data.type === MSG_TOOLBAR_PIN && data.version === VERSION) {
      postFrameViewport(
        iframesById[data.embedId] || document.getElementById(data.embedId),
      );
    }
  }

  function scan(root) {
    if (!embedOrigin) embedOrigin = scriptOrigin();
    if (!embedOrigin) return;

    var scope = root && root.querySelectorAll ? root : document;
    var nodes = scope.querySelectorAll("[data-gwada-widget]:not([" + PROCESSED + "])");
    for (var i = 0; i < nodes.length; i++) {
      mountElement(nodes[i], embedOrigin);
    }
  }

  function init() {
    embedOrigin = scriptOrigin();
    global.addEventListener("message", onMessage);
    // Scroll/Resize-Viewport erst bei Speisekarte (siehe createIframe).
    scan(document);

    if ("MutationObserver" in global) {
      var mo = new MutationObserver(function (mutations) {
        for (var i = 0; i < mutations.length; i++) {
          var m = mutations[i];
          for (var j = 0; j < m.addedNodes.length; j++) {
            var node = m.addedNodes[j];
            if (node.nodeType !== 1) continue;
            if (node.matches && node.matches("[data-gwada-widget]")) {
              scan(node.parentNode || document);
            } else if (node.querySelectorAll) {
              scan(node);
            }
          }
        }
      });
      mo.observe(document.documentElement, { childList: true, subtree: true });
    }
  }

  global.GwadaEmbed = {
    version: VERSION,
    scan: scan,
    widgets: Object.keys(WIDGETS),
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})(typeof window !== "undefined" ? window : globalThis);
