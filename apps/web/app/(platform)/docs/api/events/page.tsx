import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("events");

export default function DocsApiEventsPage() {
  return <DocsApiModulePage moduleId="events" />;
}
