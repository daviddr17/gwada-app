import { SuperadminNewsletterListScreen } from "@/components/superadmin/newsletter/superadmin-newsletter-list-screen";

export default function SuperadminNewsletterPage() {
  return (
    <div className="px-4 pb-8 pt-2 sm:px-6">
      <SuperadminNewsletterListScreen templatesOnly={false} />
    </div>
  );
}
