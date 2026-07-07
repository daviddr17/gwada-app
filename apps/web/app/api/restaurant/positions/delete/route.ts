import { handleDeleteRestaurantPositionRequest } from "@/lib/restaurant/delete-restaurant-position-server";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return handleDeleteRestaurantPositionRequest(req);
}
