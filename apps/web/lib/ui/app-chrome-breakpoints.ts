/**
 * App-Chrome Breakpoints — mobil vs. Desktop-Sidebar.
 *
 * iPhone Pro Max Landscape ≈ 932px CSS-Breite:
 * - unter `lg` (1024): Mobile Bottom-Nav + Sheet-Menü
 * - ab `md` (768): Nachrichten Master-Detail (Liste | Chat)
 */
export const APP_MOBILE_CHROME_MAX_PX = 1023;
export const APP_DESKTOP_CHROME_MIN_PX = 1024;

/** Tailwind `md` — Inbox-Split inkl. große Phones quer. */
export const APP_INBOX_SPLIT_MIN_PX = 768;

export const APP_MOBILE_CHROME_MQ = `(max-width: ${APP_MOBILE_CHROME_MAX_PX}px)`;
export const APP_DESKTOP_CHROME_MQ = `(min-width: ${APP_DESKTOP_CHROME_MIN_PX}px)`;
export const APP_INBOX_SPLIT_MQ = `(min-width: ${APP_INBOX_SPLIT_MIN_PX}px)`;
