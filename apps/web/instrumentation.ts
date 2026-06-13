import type { Instrumentation } from "next";

export async function register() {
  // noop — Hook-Datei muss export register haben (Next.js instrumentation).
}

export const onRequestError: Instrumentation.onRequestError = (
  error,
  errorRequest,
  errorContext,
) => {
  if (errorContext.renderSource !== "react-server-components") return;
  if (!errorRequest.path.startsWith("/dashboard")) return;

  const message = error instanceof Error ? error.message : String(error);
  const digest =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: string }).digest ?? "")
      : "";

  console.error("[rsc:dashboard:error]", {
    path: errorRequest.path,
    method: errorRequest.method,
    routeType: errorContext.routeType,
    message: message.slice(0, 240),
    digest: digest || undefined,
  });
};
