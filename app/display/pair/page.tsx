"use client";

import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import DisplayPairPageInner from "./pair-page-inner";

export default function DisplayPairPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-dvh items-center justify-center">
          <Loader2 className="size-10 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DisplayPairPageInner />
    </Suspense>
  );
}
