import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("gallery");

export default function DocsApiGalleryPage() {
  return <DocsApiModulePage moduleId="gallery" />;
}
