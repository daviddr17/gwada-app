import { QueryClient } from "@tanstack/react-query";

/** Web-App QueryClient — konservativ live (kein langes staleTime global). */
export function createAppQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: true,
        refetchOnReconnect: true,
      },
    },
  });
}
