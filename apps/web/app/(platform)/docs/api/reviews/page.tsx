import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("reviews");

export default function DocsApiReviewsPage() {
  return <DocsApiModulePage moduleId="reviews" />;
}
