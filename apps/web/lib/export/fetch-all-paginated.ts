import {
  LIST_PAGE_SIZE_MAX,
  type PaginatedListResult,
} from "@/lib/constants/list-pagination";

/** Alle Seiten einer paginierten Liste laden (z. B. für Tabellen-Export). */
export async function fetchAllPaginatedItems<T>(
  fetchPage: (
    page: number,
    pageSize: number,
  ) => Promise<PaginatedListResult<T>>,
  pageSize = LIST_PAGE_SIZE_MAX,
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const all = [...first.items];
  for (let page = 2; page <= first.totalPages; page++) {
    const next = await fetchPage(page, pageSize);
    all.push(...next.items);
  }
  return all;
}
