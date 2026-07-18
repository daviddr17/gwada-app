import { SuperadminNewsletterEditorScreen } from "@/components/superadmin/newsletter/superadmin-newsletter-editor-screen";

export default async function SuperadminNewsletterEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <div className="px-4 pb-8 pt-2 sm:px-6">
      <SuperadminNewsletterEditorScreen newsletterId={id} />
    </div>
  );
}
