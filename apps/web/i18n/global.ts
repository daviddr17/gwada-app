import type { AppLocale } from "./config";
import type de from "../messages/de.json";

declare module "next-intl" {
  interface AppConfig {
    Locale: AppLocale;
    Messages: typeof de;
  }
}
