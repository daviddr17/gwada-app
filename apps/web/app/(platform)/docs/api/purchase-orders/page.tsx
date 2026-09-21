import { DocsApiModulePage, docsApiModuleMetadata } from "@/components/docs/docs-api-module-page";

export const metadata = docsApiModuleMetadata("purchase_orders");

export default function DocsApiPurchaseOrdersPage() {
  return <DocsApiModulePage moduleId="purchase_orders" />;
}
