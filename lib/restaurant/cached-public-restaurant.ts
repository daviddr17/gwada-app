import "server-only";

import { cache } from "react";
import { fetchPublicRestaurantProfile } from "@/lib/restaurant/public-restaurant-server";

/** Ein Profil-Fetch pro Request (Metadata + Page). */
export const getCachedPublicRestaurantProfile = cache(fetchPublicRestaurantProfile);
