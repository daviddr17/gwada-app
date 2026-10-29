import { handleRestaurantMcpHttp } from "@/lib/api/restaurant-mcp-handler";
import {
  buildRestaurantApiCorsHeaders,
  handleRestaurantApiPreflight,
} from "@/lib/api/restaurant-api-auth-server";

export const dynamic = "force-dynamic";

/**
 * Restaurant MCP (Model Context Protocol) over Streamable HTTP.
 * Same Bearer API keys + module scopes as `/api/v1/{module}`.
 */
export async function POST(request: Request) {
  return handleRestaurantMcpHttp(request);
}

export async function GET(request: Request) {
  return handleRestaurantMcpHttp(request);
}

export async function OPTIONS(request: Request) {
  const preflight = handleRestaurantApiPreflight(request);
  if (preflight) return preflight;
  return new Response(null, {
    status: 204,
    headers: buildRestaurantApiCorsHeaders(request, []),
  });
}
