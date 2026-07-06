import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("reservation");

export default function DocsApiReservationPage() {
  return <DocsApiModulePage moduleId="reservation" />;
}
