/**
 * Gwada Embed Loader v1 — ein Script für alle Widgets (Reservierung, Speisekarte, …).
 *
 * Host-Seite:
 *   <div data-gwada-widget="reservation" data-gwada-slug="mein-restaurant"></div>
 *   <script async src="https://new.gwada.app/embed/v1/gwada.js"></script>
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
  var HEIGHT_TRANSITION = "height 0.24s cubic-bezier(0.33, 1, 0.68, 1)";
  var BRAND_FOOTER_LOGO_PATH = "/api/platform/favicon";
  var BRAND_FOOTER_ATTR = "data-gwada-brand-footer";

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
  var iframesById = Object.create(null);
  var pendingHeights = Object.create(null);
  var heightTimers = Object.create(null);

  function scriptOrigin() {
    var current = document.currentScript;
    if (current && current.src) {
      try {
        return new URL(current.src).origin;
      } catch (_e) {}
    }
    var nodes = document.querySelectorAll('script[src*="/embed/v1/gwada.js"]');
    for (var i = nodes.length - 1; i >= 0; i--) {
      try {
        return new URL(nodes[i].src).origin;
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

  function applyHeight(embedId, height, immediate) {
    var frame = embedId
      ? iframesById[embedId] || document.getElementById(embedId)
      : null;
    if (!frame || frame.tagName !== "IFRAME") return;
    var px = Math.ceil(height);
    if (px <= 0) return;

    var prev = frame.dataset.gwadaHeight
      ? parseInt(frame.dataset.gwadaHeight, 10)
      : 0;
    if (prev === px) return;

    var isFirst = prev <= 0;
    var snap = immediate || isFirst || prefersReducedMotion();
    frame.style.transition = snap ? "none" : HEIGHT_TRANSITION;
    frame.style.height = px + "px";
    frame.style.minHeight = "0";
    frame.dataset.gwadaHeight = String(px);
    postFrameViewport(frame);
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
    heightTimers[embedId] = setTimeout(function () {
      applyHeight(embedId, pendingHeights[embedId], false);
      delete pendingHeights[embedId];
      delete heightTimers[embedId];
    }, HOST_RESIZE_DEBOUNCE);
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

  function postAllFrameViewports() {
    for (var id in iframesById) {
      if (Object.prototype.hasOwnProperty.call(iframesById, id)) {
        postFrameViewport(iframesById[id]);
      }
    }
  }

  function onHostScrollOrResize() {
    postAllFrameViewports();
  }

  function onMessage(event) {
    if (!embedOrigin || event.origin !== embedOrigin) return;
    var data = event.data;
    if (!data || typeof data !== "object") return;

    if (data.type === MSG && data.version === VERSION) {
      scheduleHeight(data.embedId, data.height);
      return;
    }

    if (data.type === MSG_LEGACY) {
      scheduleHeight(data.embedId, data.height);
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
    global.addEventListener("scroll", onHostScrollOrResize, { passive: true });
    global.addEventListener("resize", onHostScrollOrResize, { passive: true });
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
