export const LIST_PAGE_SIZE_DEFAULT = 50;

export const LIST_PAGE_SIZE_MAX = 100;

export type PaginatedListMeta = {
  page: number;
  pageSize: number;
  totalCount: number;
  totalPages: number;
};

export type PaginatedListResult<T> = PaginatedListMeta & {
  items: T[];
};

export function parseListPageParam(raw: string | null | undefined): number {
  const n = Number.parseInt(raw ?? "1", 10);
  if (!Number.isFinite(n) || n < 1) return 1;
  return n;
}

export function clampListPageSize(raw: number | null | undefined): number {
  if (!raw || !Number.isFinite(raw) || raw < 1) return LIST_PAGE_SIZE_DEFAULT;
  return Math.min(Math.floor(raw), LIST_PAGE_SIZE_MAX);
}

export function listPageRange(
  page: number,
  pageSize: number,
): { from: number; to: number } {
  const safePage = Math.max(1, page);
  const from = (safePage - 1) * pageSize;
  return { from, to: from + pageSize - 1 };
}

export function totalPagesFromCount(
  totalCount: number,
  pageSize: number,
): number {
  if (totalCount <= 0) return 1;
  return Math.ceil(totalCount / pageSize);
}

export function clampListPage(page: number, totalPages: number): number {
  if (totalPages < 1) return 1;
  return Math.min(Math.max(1, page), totalPages);
}
