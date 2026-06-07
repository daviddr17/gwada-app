import "server-only";

import { cache } from "react";
import { loadRootLayoutBranding } from "@/lib/platform/layout-branding-server";

/** Ein Branding-Fetch pro Request (Metadata + Layout). */
export const getCachedRootLayoutBranding = cache(loadRootLayoutBranding);
