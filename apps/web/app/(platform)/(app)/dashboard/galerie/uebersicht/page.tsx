import { Suspense } from "react";
import { GalleryScreen } from "@/components/gallery/gallery-screen";

export default function GalerieUebersichtPage() {
  return (
    <Suspense fallback={null}>
      <GalleryScreen />
    </Suspense>
  );
}
