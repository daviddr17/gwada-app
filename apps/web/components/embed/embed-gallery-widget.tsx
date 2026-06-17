"use client";

import { useMemo, useState } from "react";
import { EmbedAccentRoot } from "@/components/embed/embed-accent-root";
import { GalleryHighlightViewer } from "@/components/gallery/gallery-highlight-viewer";
import { GalleryHighlightsRow } from "@/components/gallery/gallery-highlights-row";
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
import type { EmbedTextTheme } from "@/lib/embed/embed-appearance";
import { GALLERY_FEED_PAGE_SIZE } from "@/lib/gallery/gallery-feed-pagination";
import type { PublicEmbedGallery } from "@/lib/gallery/public-gallery-server";
import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import { cn } from "@/lib/utils";

type Props = {
  data: PublicEmbedGallery;
  variant?: "embed" | "profileSheet";
  textTheme?: EmbedTextTheme;
};

export function EmbedGalleryWidget({
  data,
  variant = "embed",
  textTheme = "dark",
}: Props) {
  const [platformFilter, setPlatformFilter] = useState<GalleryPlatformFilter>(GALLERY_FILTER_ALL);
  const [page, setPage] = useState(1);
  const [activeHighlight, setActiveHighlight] = useState<UnifiedGalleryHighlight | null>(null);
  const [highlightOpen, setHighlightOpen] = useState(false);

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

  const content = (
    <>
      <GalleryPlatformFilterChips
        value={platformFilter}
        onChange={(v) => {
          setPlatformFilter(v);
          setPage(1);
        }}
        availablePlatforms={availablePlatforms}
      />
      <GalleryHighlightsRow
        highlights={data.highlights}
        onHighlightClick={(h) => {
          setActiveHighlight(h);
          setHighlightOpen(true);
        }}
      />
      <ListPaginationSurround
        page={currentPage}
        totalPages={totalPages}
        shown={paginated.length}
        totalCount={filtered.length}
        itemLabel="Bilder"
        canPrevious={currentPage > 1}
        canNext={currentPage < totalPages}
        onPrevious={() => setPage((p) => Math.max(1, p - 1))}
        onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
      >
        <GalleryMasonryGrid items={paginated} onItemClick={() => undefined} />
      </ListPaginationSurround>

      <GalleryHighlightViewer
        highlight={activeHighlight}
        open={highlightOpen}
        onOpenChange={setHighlightOpen}
      />
    </>
  );

  if (variant === "profileSheet") {
    return <div className="space-y-4 py-4">{content}</div>;
  }

  return (
    <EmbedAccentRoot accentHex={data.accentHex} textTheme={textTheme}>
      <div className={cn("min-h-[480px] p-4")}>{content}</div>
    </EmbedAccentRoot>
  );
}
