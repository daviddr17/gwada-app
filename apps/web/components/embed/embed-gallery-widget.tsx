"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { EmbedFeedResizeReporter } from "@/components/embed/embed-feed-resize-reporter";
import { EmbedMeasureEnd } from "@/components/embed/embed-measure-boundary";
import {
  countGalleryFeedImages,
  FeedScreenLayoutStable,
} from "@/components/feed/feed-screen-layout-stable";
import { GalleryHighlightViewer } from "@/components/gallery/gallery-highlight-viewer";
import { GalleryHighlightsRow } from "@/components/gallery/gallery-highlights-row";
import { GalleryItemViewer } from "@/components/gallery/gallery-item-viewer";
import { GalleryMasonryGrid } from "@/components/gallery/gallery-masonry-grid";
import { GalleryPlatformFilterChips } from "@/components/gallery/gallery-platform-filter-chips";
import {
  ProfileGalleryLightbox,
  type GalleryLightboxOriginRect,
} from "@/components/gallery/profile-gallery-lightbox";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  GALLERY_FILTER_ALL,
  type GalleryPlatform,
  type GalleryPlatformFilter,
} from "@/lib/constants/gallery-platforms";
import {
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";
import type { AppLocale } from "@/i18n/config";
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import { GALLERY_FEED_PAGE_SIZE } from "@/lib/gallery/gallery-feed-pagination";
import type { PublicEmbedGallery } from "@/lib/gallery/public-gallery-server";
import type {
  UnifiedGalleryHighlight,
  UnifiedGalleryItem,
} from "@/lib/gallery/unified-gallery-item";

type Props = {
  data: PublicEmbedGallery;
  variant?: "embed" | "profileSheet";
  textTheme?: EmbedTextTheme;
  sourceLocale?: AppLocale;
};

export function EmbedGalleryWidget({
  data,
  variant = "embed",
  textTheme = "dark",
  sourceLocale = "de",
}: Props) {
  if (variant === "profileSheet") {
    return <EmbedGalleryWidgetBody data={data} variant={variant} />;
  }

  return (
    <EmbedAccentRoot
      accentHex={data.accentHex}
      textTheme={textTheme}
      sourceLocale={sourceLocale}
    >
      <EmbedGalleryWidgetBody data={data} variant={variant} />
    </EmbedAccentRoot>
  );
}

function EmbedGalleryWidgetBody({
  data,
  variant = "embed",
}: {
  data: PublicEmbedGallery;
  variant?: "embed" | "profileSheet";
}) {
  const t = useTranslations("Embed");
  const [platformFilter, setPlatformFilter] = useState<GalleryPlatformFilter>(GALLERY_FILTER_ALL);
  const [page, setPage] = useState(data.page ?? 1);
  const [pageData, setPageData] = useState(data);
  const [pageLoading, setPageLoading] = useState(false);
  const [activeHighlight, setActiveHighlight] = useState<UnifiedGalleryHighlight | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<UnifiedGalleryItem | null>(null);
  const [itemOpen, setItemOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOrigin, setLightboxOrigin] = useState<GalleryLightboxOriginRect | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const useProfileLightbox = variant === "profileSheet";

  const skipFetchKeyRef = useRef<string | null>(null);

  // Initial payload from parent (cache / SSR) — sync when slug/restaurant changes.
  useEffect(() => {
    setPageData(data);
    setPage(data.page ?? 1);
    setPlatformFilter(GALLERY_FILTER_ALL);
    skipFetchKeyRef.current = `${data.slug}|${data.page ?? 1}|${GALLERY_FILTER_ALL}`;
  }, [data]);

  // Server-Pagination — nie alle 1000 Items im Client halten.
  useEffect(() => {
    const key = `${data.slug}|${page}|${platformFilter}`;
    if (skipFetchKeyRef.current === key) {
      skipFetchKeyRef.current = null;
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setPageLoading(true);
    const params = new URLSearchParams({
      page: String(page),
      pageSize: String(GALLERY_FEED_PAGE_SIZE),
    });
    if (platformFilter !== GALLERY_FILTER_ALL) {
      params.set("platform", platformFilter);
    }
    void fetch(
      `/api/public/profile/${encodeURIComponent(data.slug)}/gallery?${params}`,
      { signal: controller.signal, cache: "default" },
    )
      .then(async (res) => {
        if (!res.ok) throw new Error("gallery_page_failed");
        return (await res.json()) as PublicEmbedGallery;
      })
      .then((next) => {
        if (cancelled) return;
        setPageData(next);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof DOMException && err.name === "AbortError") return;
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [data.slug, page, platformFilter]);

  const openLightbox = (
    item: UnifiedGalleryItem,
    list: UnifiedGalleryItem[],
    origin: GalleryLightboxOriginRect | null,
  ) => {
    const idx = list.findIndex((i) => i.id === item.id);
    setLightboxIndex(idx >= 0 ? idx : 0);
    setLightboxOrigin(origin);
    setLightboxOpen(true);
  };

  const availablePlatforms = useMemo(() => {
    const fromApi = pageData.availablePlatforms ?? [];
    if (fromApi.length > 0) return new Set<GalleryPlatform>(fromApi);
    const set = new Set<GalleryPlatform>(["gwada"]);
    for (const item of pageData.items) set.add(item.platform);
    return set;
  }, [pageData.availablePlatforms, pageData.items]);

  const totalCount = pageData.totalCount ?? pageData.items.length;
  const pageSize = pageData.pageSize ?? GALLERY_FEED_PAGE_SIZE;
  const totalPages = totalPagesFromCount(totalCount, pageSize);
  const currentPage = clampListPage(page, totalPages);
  const paginated = pageData.items;

  const resizeDeps = useMemo(
    () => [
      platformFilter,
      currentPage,
      paginated.length,
      totalCount,
      highlightOpen,
      itemOpen,
      lightboxOpen,
      pageLoading,
    ],
    [
      platformFilter,
      currentPage,
      paginated.length,
      totalCount,
      highlightOpen,
      itemOpen,
      lightboxOpen,
      pageLoading,
    ],
  );

  const content = (
    <>
      <GalleryPlatformFilterChips
        value={platformFilter}
        onChange={(v) => {
          setPlatformFilter(v);
          setPage(1);
        }}
        availablePlatforms={availablePlatforms}
        allLabel={t("filterAll")}
      />
      <GalleryHighlightsRow
        highlights={pageData.highlights}
        onHighlightClick={(h) => {
          setActiveHighlight(h);
          setHighlightOpen(true);
        }}
      />
      {totalCount === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("gallery.empty")}
        </p>
      ) : (
        <ListPaginationSurround
          page={currentPage}
          totalPages={totalPages}
          shown={paginated.length}
          totalCount={totalCount}
          itemLabel={t("gallery.images")}
          canPrevious={currentPage > 1 && !pageLoading}
          canNext={currentPage < totalPages && !pageLoading}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <GalleryMasonryGrid
            items={paginated}
            onItemClick={(item, meta) => {
              if (useProfileLightbox) {
                openLightbox(item, paginated, meta.rect);
                return;
              }
              setActiveItem(item);
              setItemOpen(true);
            }}
            edgeToEdge={variant === "profileSheet"}
          />
        </ListPaginationSurround>
      )}

      <GalleryHighlightViewer
        highlight={activeHighlight}
        open={highlightOpen}
        onOpenChange={setHighlightOpen}
        onItemClick={(item) => {
          if (useProfileLightbox) {
            setHighlightOpen(false);
            openLightbox(item, paginated, null);
            return;
          }
          setActiveItem(item);
          setItemOpen(true);
        }}
      />
      {useProfileLightbox ? (
        <ProfileGalleryLightbox
          items={paginated}
          index={lightboxIndex}
          originRect={lightboxOrigin}
          open={lightboxOpen}
          onOpenChange={setLightboxOpen}
          onIndexChange={setLightboxIndex}
        />
      ) : (
        <GalleryItemViewer
          item={activeItem}
          open={itemOpen}
          onOpenChange={setItemOpen}
        />
      )}
    </>
  );

  if (variant === "profileSheet") {
    return (
      <FeedScreenLayoutStable imageCount={countGalleryFeedImages(paginated)}>
        <div className="space-y-4 py-2">{content}</div>
      </FeedScreenLayoutStable>
    );
  }

  return (
    <FeedScreenLayoutStable imageCount={countGalleryFeedImages(paginated)}>
      <EmbedFeedResizeReporter widget="gallery" deps={resizeDeps} />
      <div className="space-y-4 px-4 py-5 sm:px-6" data-gwada-embed-content>
        {content}
        <EmbedMeasureEnd />
      </div>
    </FeedScreenLayoutStable>
  );
}
