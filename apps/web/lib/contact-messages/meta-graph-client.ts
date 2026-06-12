import "server-only";

import { META_GRAPH_VERSION } from "@/lib/constants/integration-oauth-scopes";
import {
  formatMetaGraphError,
  type MetaGraphErrorContext,
} from "@/lib/integrations/meta-graph-error-message";

type MetaGraphErrorBody = {
  error?: { message?: string; code?: number; error_subcode?: number };
};

function metaGraphFailure(
  body: MetaGraphErrorBody,
  status: number,
  context?: MetaGraphErrorContext,
): string {
  const code = body.error?.code;
  const sub = body.error?.error_subcode;
  const detail =
    code != null
      ? ` [${code}${sub != null ? `/${sub}` : ""}]`
      : "";
  const raw = body.error?.message ?? `meta_graph_${status}`;
  return `${formatMetaGraphError(raw, {
    ...context,
    errorCode: code ?? null,
  })}${detail}`;
}

export async function metaGraphGet<T>(
  url: string,
  context?: MetaGraphErrorContext,
): Promise<{ data: T | null; error: string | null }> {
  const res = await fetch(url, { cache: "no-store" });
  const body = (await res.json()) as T & MetaGraphErrorBody;
  if (!res.ok) {
    return {
      data: null,
      error: metaGraphFailure(body, res.status, context),
    };
  }
  return { data: body, error: null };
}

export async function metaGraphPostJson<T>(params: {
  path: string;
  accessToken: string;
  body: Record<string, unknown>;
  errorContext?: MetaGraphErrorContext;
}): Promise<{ data: T | null; error: string | null }> {
  const q = new URLSearchParams({ access_token: params.accessToken });
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.path}?${q}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params.body),
    cache: "no-store",
  });
  const json = (await res.json()) as T & MetaGraphErrorBody;
  if (!res.ok) {
    return {
      data: null,
      error: metaGraphFailure(json, res.status, params.errorContext),
    };
  }
  return { data: json, error: null };
}

export async function metaGraphPostMultipart<T>(params: {
  path: string;
  accessToken: string;
  fields: Record<string, string>;
  fileFieldName: string;
  fileName: string;
  mimeType: string;
  bytes: Buffer;
  errorContext?: MetaGraphErrorContext;
}): Promise<{ data: T | null; error: string | null }> {
  const q = new URLSearchParams({ access_token: params.accessToken });
  const url = `https://graph.facebook.com/${META_GRAPH_VERSION}/${params.path}?${q}`;
  const form = new FormData();
  for (const [key, value] of Object.entries(params.fields)) {
    form.append(key, value);
  }
  const blob = new Blob([new Uint8Array(params.bytes)], {
    type: params.mimeType,
  });
  form.append(params.fileFieldName, blob, params.fileName);

  const res = await fetch(url, { method: "POST", body: form, cache: "no-store" });
  const json = (await res.json()) as T & MetaGraphErrorBody;
  if (!res.ok) {
    return {
      data: null,
      error: metaGraphFailure(json, res.status, params.errorContext),
    };
  }
  return { data: json, error: null };
}
