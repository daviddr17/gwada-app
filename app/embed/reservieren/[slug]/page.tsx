import { EmbedReservationWidget } from "@/components/embed/embed-reservation-widget";
import { publicCountries } from "@/lib/reservations/public-embed-shared";
import { fetchPublicEmbedRestaurant } from "@/lib/reservations/public-reservation-server";

export const dynamic = "force-dynamic";

export default async function EmbedReservierenPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await fetchPublicEmbedRestaurant(slug);

  if (!result.data) {
    return (
      <div className="flex min-h-[12rem] items-center justify-center px-6 py-10 text-center text-sm text-muted-foreground">
        {result.error === "not_found"
          ? "Dieses Reservierungsformular ist derzeit nicht verfügbar."
          : "Das Formular konnte nicht geladen werden."}
      </div>
    );
  }

  return (
    <EmbedReservationWidget
      config={result.data}
      countries={publicCountries()}
    />
  );
}
