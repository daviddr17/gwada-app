import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("opening_hours");

export default function DocsApiOpeningHoursPage() {
  return <DocsApiModulePage moduleId="opening_hours" />;
}
