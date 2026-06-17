import { PartyPopper } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";

export function EventsComingSoonScreen() {
  return (
    <Card className="border-border/50 shadow-card">
      <CardContent className="flex min-h-[min(28rem,60dvh)] flex-col items-center justify-center gap-4 px-6 py-16 text-center">
        <div className="flex size-24 items-center justify-center rounded-3xl bg-accent/10 text-accent">
          <PartyPopper className="size-14" strokeWidth={1.5} aria-hidden />
        </div>
        <p className="text-lg text-muted-foreground">Coming soon…</p>
      </CardContent>
    </Card>
  );
}
