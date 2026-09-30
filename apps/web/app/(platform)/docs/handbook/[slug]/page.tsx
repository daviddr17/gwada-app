import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DocsUserGuidePage } from "@/components/docs/docs-user-guide-page";
import {
  userGuideBySlug,
  userGuideSlugs,
} from "@/lib/docs/user-guide-content";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return userGuideSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const guide = userGuideBySlug(slug);
  if (!guide) return { title: "Handbuch" };
  return {
    title: guide.title,
    description: guide.description,
  };
}

export default async function DocsHandbuchPage({ params }: PageProps) {
  const { slug } = await params;
  const guide = userGuideBySlug(slug);
  if (!guide) notFound();
  return <DocsUserGuidePage guide={guide} />;
}
