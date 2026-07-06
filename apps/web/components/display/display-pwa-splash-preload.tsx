import { preload } from "react-dom";
import { displayPwaIconPath } from "@/lib/display/display-pwa-config";

/** Splash-Icon früh laden — nahtloser Übergang vom OS-Splash. */
export function DisplayPwaSplashPreload() {
  preload(displayPwaIconPath(192), {
    as: "image",
    fetchPriority: "high",
  });
  return null;
}
