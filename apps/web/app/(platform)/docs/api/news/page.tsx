import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("news");

export default function DocsApiNewsPage() {
  return <DocsApiModulePage moduleId="news" />;
}
