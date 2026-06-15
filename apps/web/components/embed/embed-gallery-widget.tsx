"use client";

import { useMemo, useState } from "react";
import type { PublicEmbedGallery } from "@/lib/gallery/public-gallery-server";
import { GalleryHighlightViewer } from "@/components/gallery/gallery-highlight-viewer";
import { GalleryHighlightsRow } from "@/components/gallery/gallery-highlights-row";
import { GalleryMasonryGrid } from "@/components/gallery/gallery-masonry-grid";
import { GalleryPlatformFilterChips } from "@/components/gallery/gallery-platform-filter-chips";
import {
  GALLERY_FILTER_ALL,
  type GalleryPlatform,
  type GalleryPlatformFilter,
} from "@/lib/constants/gallery-platforms";
import { GALLERY_FEED_PAGE_SIZE } from "@/lib/gallery/gallery-feed-pagination";
import type { UnifiedGalleryHighlight } from "@/lib/gallery/unified-gallery-item";
import { ListPaginationSurround } from "@/components/ui/list-pagination";
import {
  clampListPage,
  totalPagesFromCount,
} from "@/lib/constants/list-pagination";

type Props = {
  data: PublicEmbedGallery;
  variant?: "embed" | "profileSheet";
};

export function EmbedGalleryWidget({ data, variant = "embed" }: Props) {
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

  return (
    <div
      className={
        variant === "embed"
          ? "min-h-[480px] bg-background p-4"
          : "space-y-4 py-4"
      }
      style={{ ["--accent" as string]: data.accentHex }}
    >
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
    </div>
  );
}
