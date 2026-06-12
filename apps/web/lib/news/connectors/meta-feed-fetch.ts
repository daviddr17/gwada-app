import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import {
  formatMetaGraphError,
  type MetaGraphErrorContext,
} from "@/lib/integrations/meta-graph-error-message";

type MetaFeedFetchResult<T> =
  | { ok: true; data: T[] }
  | { ok: false; error: string };

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
      error: `${formatMetaGraphError(body.error?.message, params.context)}${detail}`,
    };
  }
  return { ok: true, data: body.data ?? [] };
}
