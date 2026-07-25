"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { FeedMediaImage } from "@/components/feed/feed-media-image";
import { FeedVideoTile } from "@/components/feed/feed-video-tile";
import { Button } from "@/components/ui/button";
import { galleryItemDisplayUrls } from "@/lib/gallery/gallery-item-display-urls";
import type { UnifiedGalleryItem } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

export type GalleryLightboxOriginRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type ProfileGalleryLightboxProps = {
  items: UnifiedGalleryItem[];
  index: number;
  originRect: GalleryLightboxOriginRect | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onIndexChange: (index: number) => void;
};

function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0;
  return ((index % length) + length) % length;
}

function rectFromDom(el: Element | null): GalleryLightboxOriginRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width < 8 || r.height < 8) return null;
  return { top: r.top, left: r.left, width: r.width, height: r.height };
}

export function readGalleryLightboxThumbRect(itemId: string): GalleryLightboxOriginRect | null {
  if (typeof document === "undefined") return null;
  return rectFromDom(document.querySelector(`[data-gallery-lightbox-id="${itemId}"]`));
}

function viewportTarget(aspect: number | null): GalleryLightboxOriginRect {
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const padX = Math.min(48, vw * 0.06);
  const padY = Math.min(64, vh * 0.1);
  const maxW = vw - padX * 2;
  const maxH = vh - padY * 2;
  const a = aspect && aspect > 0 ? aspect : 4 / 3;
  let width = maxW;
  let height = width / a;
  if (height > maxH) {
    height = maxH;
    width = height * a;
  }
  return {
    left: (vw - width) / 2,
    top: (vh - height) / 2,
    width,
    height,
  };
}

function itemAspect(item: UnifiedGalleryItem | null): number | null {
  if (!item) return null;
  if (item.width && item.height && item.width > 0 && item.height > 0) {
    return item.width / item.height;
  }
  return null;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function lerpRect(
  from: GalleryLightboxOriginRect,
  to: GalleryLightboxOriginRect,
  t: number,
): GalleryLightboxOriginRect {
  return {
    top: from.top + (to.top - from.top) * t,
    left: from.left + (to.left - from.left) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

function applyFrameStyle(
  el: HTMLElement | null,
  rect: GalleryLightboxOriginRect,
): void {
  if (!el) return;
  el.style.top = `${rect.top}px`;
  el.style.left = `${rect.left}px`;
  el.style.width = `${rect.width}px`;
  el.style.height = `${rect.height}px`;
}

export function ProfileGalleryLightbox({
  items,
  index,
  originRect,
  open,
  onOpenChange,
  onIndexChange,
}: ProfileGalleryLightboxProps) {
  const reduceMotion = useReducedMotion();
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);
  const [phase, setPhase] = useState<"idle" | "opening" | "open" | "closing">("idle");
  const [chromeVisible, setChromeVisible] = useState(false);
  const animRef = useRef<number | null>(null);
  const openSessionRef = useRef(0);
  const openCycleActiveRef = useRef(false);
  const touchStartX = useRef<number | null>(null);
  const openingFromRef = useRef<GalleryLightboxOriginRect | null>(null);
  const frameRef = useRef<GalleryLightboxOriginRect | null>(null);
  const backdropOpacityRef = useRef(0);
  const frameElRef = useRef<HTMLDivElement | null>(null);
  const backdropElRef = useRef<HTMLButtonElement | null>(null);

  const safeIndex = clampIndex(index, items.length);
  const item = items[safeIndex] ?? null;
  const canNavigate = items.length > 1;
  const aspect = itemAspect(item);

  useEffect(() => {
    setMounted(true);
  }, []);

  const cancelAnim = useCallback(() => {
    if (animRef.current != null) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
  }, []);

  const paintFrame = useCallback((rect: GalleryLightboxOriginRect, opacity: number) => {
    frameRef.current = rect;
    backdropOpacityRef.current = opacity;
    applyFrameStyle(frameElRef.current, rect);
    if (backdropElRef.current) {
      backdropElRef.current.style.opacity = String(opacity);
    }
  }, []);

  const tween = useCallback(
    (
      from: GalleryLightboxOriginRect,
      to: GalleryLightboxOriginRect,
      durationMs: number,
      backdropFrom: number,
      backdropTo: number,
      onDone: () => void,
    ) => {
      cancelAnim();
      if (reduceMotion || durationMs <= 0) {
        paintFrame(to, backdropTo);
        onDone();
        return;
      }
      const start = performance.now();
      const tick = (now: number) => {
        const t = easeOutCubic(Math.min(1, (now - start) / durationMs));
        paintFrame(lerpRect(from, to, t), backdropFrom + (backdropTo - backdropFrom) * t);
        if (t < 1) {
          animRef.current = requestAnimationFrame(tick);
        } else {
          animRef.current = null;
          onDone();
        }
      };
      animRef.current = requestAnimationFrame(tick);
    },
    [cancelAnim, paintFrame, reduceMotion],
  );

  // Open: morph from clicked thumb into viewport (or soft scale-up without origin).
  useLayoutEffect(() => {
    if (!open) {
      openCycleActiveRef.current = false;
      return;
    }
    if (!item || openCycleActiveRef.current) return;
    openCycleActiveRef.current = true;

    const session = ++openSessionRef.current;
    const to = viewportTarget(aspect);
    const from = originRect
      ? { ...originRect }
      : {
          left: to.left + to.width * 0.2,
          top: to.top + to.height * 0.2,
          width: to.width * 0.6,
          height: to.height * 0.6,
        };
    openingFromRef.current = from;
    setVisible(true);
    setPhase("opening");
    setChromeVisible(false);
    // Paint after mount of portal nodes.
    requestAnimationFrame(() => {
      paintFrame(from, 0);
      tween(from, to, 340, 0, 1, () => {
        if (openSessionRef.current !== session) return;
        paintFrame(to, 1);
        setPhase("open");
        setChromeVisible(true);
      });
    });
  }, [open, originRect, item, aspect, tween, paintFrame]);

  // Soft resize when aspect / window changes while open.
  useEffect(() => {
    if (!visible || phase !== "open") return;
    const sync = () => paintFrame(viewportTarget(aspect), 1);
    sync();
    window.addEventListener("resize", sync);
    return () => window.removeEventListener("resize", sync);
  }, [visible, phase, aspect, safeIndex, paintFrame]);

  const finishClose = useCallback(() => {
    cancelAnim();
    setVisible(false);
    setPhase("idle");
    frameRef.current = null;
    backdropOpacityRef.current = 0;
    setChromeVisible(false);
    openingFromRef.current = null;
    onOpenChange(false);
  }, [cancelAnim, onOpenChange]);

  const requestClose = useCallback(() => {
    if (!visible || phase === "closing" || !item) return;
    const session = ++openSessionRef.current;
    const from = frameRef.current ?? viewportTarget(aspect);
    const to =
      readGalleryLightboxThumbRect(item.id) ??
      openingFromRef.current ??
      viewportTarget(aspect);
    setPhase("closing");
    setChromeVisible(false);
    tween(from, to, 300, backdropOpacityRef.current, 0, () => {
      if (openSessionRef.current !== session) return;
      finishClose();
    });
  }, [visible, phase, item, aspect, tween, finishClose]);

  // Parent closed externally.
  useEffect(() => {
    if (open) return;
    if (!visible) return;
    if (phase === "closing") return;
    finishClose();
  }, [open, visible, phase, finishClose]);

  const go = useCallback(
    (delta: number) => {
      if (!canNavigate || phase !== "open") return;
      onIndexChange(clampIndex(safeIndex + delta, items.length));
    },
    [canNavigate, phase, onIndexChange, safeIndex, items.length],
  );

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        requestClose();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        go(1);
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [visible, requestClose, go]);

  // Hide the source thumb while open/opening so the morph clone isn't doubled.
  // Restore on close so the shrink lands on a visible tile.
  useEffect(() => {
    if (!visible || !item || phase === "closing") return;
    const el = document.querySelector<HTMLElement>(
      `[data-gallery-lightbox-id="${item.id}"]`,
    );
    if (!el) return;
    const prev = el.style.opacity;
    el.style.opacity = "0";
    return () => {
      el.style.opacity = prev;
    };
  }, [visible, item?.id, phase]);

  useEffect(() => () => cancelAnim(), [cancelAnim]);

  if (!mounted || !visible || !item) return null;

  const { src, thumbSrc } = galleryItemDisplayUrls(item);
  const videoSrc = item.fullUrl?.trim() || item.previewUrl;
  const title = item.title?.trim() || item.caption?.trim() || "";
  const showChrome = chromeVisible && phase === "open";
  const initialFrame = frameRef.current ?? openingFromRef.current ?? viewportTarget(aspect);

  return createPortal(
    <div className="fixed inset-0 z-[220]" role="dialog" aria-modal="true" aria-label="Galerie">
      <button
        ref={backdropElRef}
        type="button"
        aria-label="Schließen"
        className="absolute inset-0 bg-black/80"
        style={{ opacity: backdropOpacityRef.current }}
        onClick={requestClose}
      />

      <div
        ref={frameElRef}
        className="absolute overflow-hidden rounded-md bg-black shadow-2xl"
        style={{
          top: initialFrame.top,
          left: initialFrame.left,
          width: initialFrame.width,
          height: initialFrame.height,
          willChange: "top, left, width, height",
        }}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={(e) => {
          touchStartX.current = e.changedTouches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchStartX.current;
          touchStartX.current = null;
          if (start == null || phase !== "open") return;
          const end = e.changedTouches[0]?.clientX ?? start;
          const dx = end - start;
          if (Math.abs(dx) < 56) return;
          go(dx > 0 ? -1 : 1);
        }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={item.id}
            className="size-full"
            initial={reduceMotion || phase !== "open" ? false : { opacity: 0.25 }}
            animate={{ opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0.15 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            {item.mediaKind === "video" ? (
              <FeedVideoTile src={videoSrc} className="size-full object-contain" />
            ) : (
              <FeedMediaImage
                src={src}
                thumbSrc={thumbSrc}
                blurDataUrl={item.blurDataUrl}
                width={item.width}
                height={item.height}
                alt={title || "Galeriebild"}
                fit="contain"
                className="size-full"
                imgClassName="size-full object-contain"
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 flex items-start justify-end p-3 transition-opacity duration-200 sm:p-4",
          showChrome ? "opacity-100" : "opacity-0",
        )}
      >
        <Button
          type="button"
          size="icon"
          variant="secondary"
          className="pointer-events-auto size-10 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70"
          onClick={requestClose}
          aria-label="Schließen"
        >
          <X className="size-5" />
        </Button>
      </div>

      {canNavigate ? (
        <>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={cn(
              "absolute top-1/2 left-2 size-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70 sm:left-4",
              "transition-opacity duration-200",
              showChrome ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={() => go(-1)}
            aria-label="Vorheriges Bild"
          >
            <ChevronLeft className="size-6" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="secondary"
            className={cn(
              "absolute top-1/2 right-2 size-11 -translate-y-1/2 rounded-full border border-white/20 bg-black/55 text-white hover:bg-black/70 sm:right-4",
              "transition-opacity duration-200",
              showChrome ? "opacity-100" : "pointer-events-none opacity-0",
            )}
            onClick={() => go(1)}
            aria-label="Nächstes Bild"
          >
            <ChevronRight className="size-6" />
          </Button>
        </>
      ) : null}

      {title || items.length > 1 ? (
        <div
          className={cn(
            "pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-1 px-4 pb-5 pt-10 transition-opacity duration-200",
            "bg-gradient-to-t from-black/70 to-transparent",
            showChrome ? "opacity-100" : "opacity-0",
          )}
        >
          {title ? (
            <p className="max-w-xl text-center text-sm font-medium text-white drop-shadow">{title}</p>
          ) : null}
          {items.length > 1 ? (
            <p className="text-xs text-white/70">
              {safeIndex + 1} / {items.length}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>,
    document.body,
  );
}
