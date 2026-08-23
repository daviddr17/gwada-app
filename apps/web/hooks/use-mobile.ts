import * as React from "react";
import {
  APP_DESKTOP_CHROME_MIN_PX,
  APP_MOBILE_CHROME_MQ,
} from "@/lib/ui/app-chrome-breakpoints";

/** Unter Desktop-Chrome (`lg` / 1024): Bottom-Nav + Sheet-Sidebar. */
export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(APP_MOBILE_CHROME_MQ);
    const onChange = () => {
      setIsMobile(window.innerWidth < APP_DESKTOP_CHROME_MIN_PX);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < APP_DESKTOP_CHROME_MIN_PX);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return !!isMobile;
}
