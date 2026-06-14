import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import {
  formatMetaGraphError,
  type MetaGraphErrorContext,
} from "@/lib/integrations/meta-graph-error-message";

type MetaFeedFetchResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string };

type MetaListBody<T> = {
  data?: T[];
  paging?: { next?: string };
  error?: { message?: string; code?: number; error_subcode?: number };
};

export async function metaGraphListFetchAll<T>(params: {
  path: string;
  token: string;
  context: MetaGraphErrorContext;
  maxPages?: number;
}): Promise<MetaFeedFetchResult<T>> {
  const maxPages = params.maxPages ?? 10;
  const items: T[] = [];
  let url: string | null =
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.path}`;
  let lastError: string | null = null;

  for (let page = 0; page < maxPages && url; page += 1) {
    const useBearer = !url.includes("access_token=");
    const res = await fetch(url, {
      headers: useBearer ? { Authorization: `Bearer ${params.token}` } : undefined,
      cache: "no-store",
    });
    const body = (await res.json()) as MetaListBody<T>;
    if (!res.ok) {
      const code = body.error?.code;
      const sub = body.error?.error_subcode;
      const detail =
        code != null ? ` [${code}${sub != null ? `/${sub}` : ""}]` : "";
      lastError = `${formatMetaGraphError(body.error?.message, {
        ...params.context,
        errorCode: code ?? null,
      })}${detail}`;
      break;
    }
    items.push(...(body.data ?? []));
    url = body.paging?.next?.trim() ?? null;
  }

  if (items.length === 0 && lastError) {
    return { ok: false, error: lastError };
  }
  return { ok: true, data: items };
}

export async function metaGraphListFetch<T>(params: {
  path: string;
  token: string;
  context: MetaGraphErrorContext;
}): Promise<MetaFeedFetchResult<T>> {
  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.path}`,
    {
      headers: { Authorization: `Bearer ${params.token}` },
      cache: "no-store",
    },
  );
  const body = (await res.json()) as {
    data?: T[];
    error?: { message?: string; code?: number; error_subcode?: number };
  };
  if (!res.ok) {
    const code = body.error?.code;
    const sub = body.error?.error_subcode;
    const detail =
      code != null ? ` [${code}${sub != null ? `/${sub}` : ""}]` : "";
    return {
      ok: false,
      error: `${formatMetaGraphError(body.error?.message, {
        ...params.context,
        errorCode: code ?? null,
      })}${detail}`,
    };
  }
  return { ok: true, data: body.data ?? [] };
}
