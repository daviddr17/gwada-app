import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("menu");

export default function DocsApiMenuPage() {
  return <DocsApiModulePage moduleId="menu" />;
}
