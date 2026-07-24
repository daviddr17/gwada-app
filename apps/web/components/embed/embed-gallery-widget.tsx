"use client";

import { useMemo, useState } from "react";
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
  const [page, setPage] = useState(1);
  const [activeHighlight, setActiveHighlight] = useState<UnifiedGalleryHighlight | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);
  const [activeItem, setActiveItem] = useState<UnifiedGalleryItem | null>(null);
  const [itemOpen, setItemOpen] = useState(false);

  const availablePlatforms = useMemo(() => {
    const set = new Set<GalleryPlatform>(["gwada"]);
    for (const item of data.items) set.add(item.platform);
    return set;
  }, [data.items]);

  const filtered = useMemo(() => {
    if (platformFilter === GALLERY_FILTER_ALL) return data.items;
    return data.items.filter((i) => i.platform === platformFilter);
  }, [data.items, platformFilter]);

  const totalPages = totalPagesFromCount(filtered.length, GALLERY_FEED_PAGE_SIZE);
  const currentPage = clampListPage(page, totalPages);
  const paginated = useMemo(() => {
    const from = (currentPage - 1) * GALLERY_FEED_PAGE_SIZE;
    return filtered.slice(from, from + GALLERY_FEED_PAGE_SIZE);
  }, [filtered, currentPage]);

  const resizeDeps = useMemo(
    () => [
      platformFilter,
      currentPage,
      paginated.length,
      filtered.length,
      highlightOpen,
      itemOpen,
    ],
    [
      platformFilter,
      currentPage,
      paginated.length,
      filtered.length,
      highlightOpen,
      itemOpen,
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
        highlights={data.highlights}
        onHighlightClick={(h) => {
          setActiveHighlight(h);
          setHighlightOpen(true);
        }}
      />
      {filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          {t("gallery.empty")}
        </p>
      ) : (
        <ListPaginationSurround
          page={currentPage}
          totalPages={totalPages}
          shown={paginated.length}
          totalCount={filtered.length}
          itemLabel={t("gallery.images")}
          canPrevious={currentPage > 1}
          canNext={currentPage < totalPages}
          onPrevious={() => setPage((p) => Math.max(1, p - 1))}
          onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
        >
          <GalleryMasonryGrid
            items={paginated}
            onItemClick={(item) => {
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
          setActiveItem(item);
          setItemOpen(true);
        }}
      />
      <GalleryItemViewer
        item={activeItem}
        open={itemOpen}
        onOpenChange={setItemOpen}
      />
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
      <div className="space-y-4 p-4" data-gwada-embed-content>
        {content}
        <EmbedMeasureEnd />
      </div>
    </FeedScreenLayoutStable>
  );
}
