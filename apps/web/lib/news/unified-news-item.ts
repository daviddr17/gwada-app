import type { NewsPlatform } from "@/lib/constants/news-platforms";

export type NewsMediaPreview = {
  id: string;
  kind: "image" | "video";
  url: string | null;
  thumbUrl?: string | null;
  storagePath: string | null;
  mimeType: string | null;
  sortOrder: number;
  width?: number | null;
  height?: number | null;
  blurDataUrl?: string | null;
};

export type NewsInsights = {
  likes?: number;
  comments?: number;
  views?: number;
  shares?: number;
};

export type UnifiedNewsItem = {
  id: string;
  platform: NewsPlatform;
  source: "gwada" | "external";
  postId: string | null;
  title: string | null;
  body: string;
  media: NewsMediaPreview[];
  createdAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  status: "draft" | "scheduled" | "published" | "failed" | "archived";
  canEdit: boolean;
  canDelete: boolean;
  externalUrl: string | null;
  insights: NewsInsights | null;
  authorName: string | null;
  /** Max. ein Pin pro Restaurant — sortiert nach oben. */
  isPinned?: boolean;
};
