"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  isDefaultSalesDocumentSort,
  isDefaultVoucherSort,
  parseAccountingListSortDir,
  parseSalesDocumentSortKey,
  parseVoucherSortKey,
  type AccountingListSortDir,
  type AccountingSalesDocumentSortKey,
  type AccountingVoucherSortKey,
} from "@/lib/accounting/accounting-list-sort";
import {
  parseAccountingPlatformFilter,
  type AccountingPlatformFilter,
} from "@/lib/constants/accounting-platforms";
import { parseListPageParam } from "@/lib/constants/list-pagination";

export type AccountingListSortMode = "sales" | "voucher";

type SalesListUrl = {
  page: number;
  search: string;
  platformFilter: AccountingPlatformFilter;
  sortKey: AccountingSalesDocumentSortKey;
  sortDir: AccountingListSortDir;
  setSearchQuery: (q: string) => void;
  setPage: (nextPage: number) => void;
  setPlatformFilter: (filter: AccountingPlatformFilter) => void;
  syncPageFromServer: (serverPage: number) => void;
  toggleSort: (key: AccountingSalesDocumentSortKey) => void;
};

type VoucherListUrl = {
  page: number;
  search: string;
  platformFilter: AccountingPlatformFilter;
  sortKey: AccountingVoucherSortKey;
  sortDir: AccountingListSortDir;
  setSearchQuery: (q: string) => void;
  setPage: (nextPage: number) => void;
  setPlatformFilter: (filter: AccountingPlatformFilter) => void;
  syncPageFromServer: (serverPage: number) => void;
  toggleSort: (key: AccountingVoucherSortKey) => void;
};

export function useAccountingListUrl(sortMode: "sales"): SalesListUrl;
export function useAccountingListUrl(sortMode: "voucher"): VoucherListUrl;
export function useAccountingListUrl(
  sortMode: AccountingListSortMode = "sales",
): SalesListUrl | VoucherListUrl {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const page = parseListPageParam(searchParams.get("page"));
  const search = searchParams.get("q") ?? "";
  const platformFilter = parseAccountingPlatformFilter(
    searchParams.get("platform"),
  );
  const sortDir = parseAccountingListSortDir(searchParams.get("dir"));
  const sortKey =
    sortMode === "voucher"
      ? parseVoucherSortKey(searchParams.get("sort"))
      : parseSalesDocumentSortKey(searchParams.get("sort"));

  const replaceParams = useCallback(
    (mutate: (next: URLSearchParams) => void) => {
      const next = new URLSearchParams(searchParams.toString());
      mutate(next);
      router.replace(next.toString() ? `${pathname}?${next}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const setSearchQuery = useCallback(
    (q: string) => {
      replaceParams((next) => {
        const trimmed = q.trim();
        if (trimmed) next.set("q", trimmed);
        else next.delete("q");
        next.delete("page");
      });
    },
    [replaceParams],
  );

  const setPage = useCallback(
    (nextPage: number) => {
      replaceParams((next) => {
        if (nextPage <= 1) next.delete("page");
        else next.set("page", String(nextPage));
      });
    },
    [replaceParams],
  );

  const setPlatformFilter = useCallback(
    (filter: AccountingPlatformFilter) => {
      replaceParams((next) => {
        if (filter === "all") next.delete("platform");
        else next.set("platform", filter);
        next.delete("page");
      });
    },
    [replaceParams],
  );

  const syncPageFromServer = useCallback(
    (serverPage: number) => {
      if (serverPage === page) return;
      replaceParams((next) => {
        if (serverPage <= 1) next.delete("page");
        else next.set("page", String(serverPage));
      });
    },
    [page, replaceParams],
  );

  const toggleSort = useCallback(
    (key: AccountingSalesDocumentSortKey | AccountingVoucherSortKey) => {
      replaceParams((next) => {
        const currentKey =
          sortMode === "voucher"
            ? parseVoucherSortKey(next.get("sort"))
            : parseSalesDocumentSortKey(next.get("sort"));
        const currentDir = parseAccountingListSortDir(next.get("dir"));
        const nextDir: AccountingListSortDir =
          currentKey === key && currentDir === "desc" ? "asc" : "desc";

        if (sortMode === "voucher") {
          const voucherKey = key as AccountingVoucherSortKey;
          if (isDefaultVoucherSort(voucherKey, nextDir)) {
            next.delete("sort");
            next.delete("dir");
          } else {
            next.set("sort", voucherKey);
            next.set("dir", nextDir);
          }
        } else {
          const salesKey = key as AccountingSalesDocumentSortKey;
          if (isDefaultSalesDocumentSort(salesKey, nextDir)) {
            next.delete("sort");
            next.delete("dir");
          } else {
            next.set("sort", salesKey);
            next.set("dir", nextDir);
          }
        }
        next.delete("page");
      });
    },
    [replaceParams, sortMode],
  );

  return {
    page,
    search,
    platformFilter,
    sortKey,
    sortDir,
    setSearchQuery,
    setPage,
    setPlatformFilter,
    syncPageFromServer,
    toggleSort,
  } as SalesListUrl | VoucherListUrl;
}
