import * as React from "react";

/** Tablet + Mobil — numerische Tastatur für Personen, Telefon, Verweildauer. */
export const TOUCH_TABLET_MAX_WIDTH_PX = 1024;

export function useIsTouchTablet(): boolean {
  const [isTouchTablet, setIsTouchTablet] = React.useState(false);

  React.useEffect(() => {
    const evaluate = () => {
      setIsTouchTablet(
        window.innerWidth <= TOUCH_TABLET_MAX_WIDTH_PX ||
          window.matchMedia("(pointer: coarse)").matches,
      );
    };
    evaluate();
    const widthQuery = window.matchMedia(
      `(max-width: ${TOUCH_TABLET_MAX_WIDTH_PX}px)`,
    );
    const coarseQuery = window.matchMedia("(pointer: coarse)");
    widthQuery.addEventListener("change", evaluate);
    coarseQuery.addEventListener("change", evaluate);
    return () => {
      widthQuery.removeEventListener("change", evaluate);
      coarseQuery.removeEventListener("change", evaluate);
    };
  }, []);

  return isTouchTablet;
}
