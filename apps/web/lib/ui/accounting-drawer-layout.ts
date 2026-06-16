/** Großes Buchführungs-Bottom-Sheet (Beleg-Detail, Beleg erfassen). */
export const accountingVoucherDrawerContentClassName =
  "mx-auto flex max-h-[92dvh] w-full max-w-6xl flex-col overflow-hidden";

/** Scroll-Container: füllt verfügbare Höhe unter Header/Footer. */
export const accountingVoucherDrawerBodyClassName =
  "flex min-h-0 flex-1 flex-col overflow-hidden";

/** Zwei Spalten (Anhang + Formular) auf Desktop — jeweils eigener Scroll. */
export const accountingVoucherDrawerSplitGridClassName =
  "min-h-0 flex-1 px-4 pt-3 md:px-6 lg:grid lg:grid-cols-[minmax(280px,42%)_minmax(0,1fr)] lg:gap-6 lg:overflow-hidden";

export const accountingVoucherDrawerSplitPaneClassName =
  "min-h-0 overflow-y-auto pb-6 lg:pr-1";

/** Einspaltiger Scroll-Inhalt ohne Anhang-Spalte. */
export const accountingVoucherDrawerScrollBodyClassName =
  "min-h-0 flex-1 overflow-y-auto px-4 pb-6 pt-3 md:px-6";
