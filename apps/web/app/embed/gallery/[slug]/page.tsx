import { EmbedGalleryWidget } from "@/components/embed/embed-gallery-widget";
import { fetchPublicEmbedGallery } from "@/lib/gallery/public-gallery-server";

type Props = {
  params: Promise<{ slug: string }>;
};

export default async function EmbedGalleryPage({ params }: Props) {
  const { slug } = await params;
  const data = await fetchPublicEmbedGallery(slug);
  if (!data) {
    return (
      <div className="flex min-h-[240px] items-center justify-center p-6 text-sm text-muted-foreground">
        Galerie nicht verfügbar.
      </div>
    );
  }

  return <EmbedGalleryWidget data={data} variant="embed" />;
}
