"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function PublicReviewPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : null;
  const [loading, setLoading] = useState(true);
  const [restaurantName, setRestaurantName] = useState("");
  const [canSubmit, setCanSubmit] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [guestName, setGuestName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/review-invitation/${token}`);
        const data = (await res.json()) as {
          restaurantName?: string;
          canSubmit?: boolean;
          completed?: boolean;
          expired?: boolean;
        };
        if (!res.ok) {
          setCanSubmit(false);
          return;
        }
        setRestaurantName(data.restaurantName ?? "Restaurant");
        setCanSubmit(Boolean(data.canSubmit));
        setCompleted(Boolean(data.completed));
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const submit = async () => {
    if (!token || rating < 1) {
      toast.error("Bitte eine Sternebewertung wählen.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch(`/api/public/review-invitation/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rating,
          comment,
          guestName,
        }),
      });
      if (!res.ok) {
        const data = (await res.json()) as { error?: string };
        toast.error(
          data.error === "already_submitted"
            ? "Du hast bereits bewertet."
            : data.error === "expired"
              ? "Der Link ist abgelaufen."
              : "Bewertung konnte nicht gesendet werden.",
        );
        return;
      }
      setCompleted(true);
      setCanSubmit(false);
      toast.success("Danke für deine Bewertung!");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md border-border/50 shadow-card">
        <CardHeader>
          <CardTitle className="text-xl">Bewertung</CardTitle>
          <CardDescription>
            {loading
              ? "Wird geladen…"
              : completed
                ? `Danke — deine Bewertung für ${restaurantName} ist eingegangen.`
                : canSubmit
                  ? `Wie war dein Besuch bei ${restaurantName}?`
                  : "Dieser Bewertungslink ist nicht mehr gültig."}
          </CardDescription>
        </CardHeader>
        {canSubmit && !completed ? (
          <CardContent className="space-y-4">
            <div className="flex justify-center gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setRating(n)}
                  className="rounded-lg p-1 transition-transform hover:scale-110"
                  aria-label={`${n} Sterne`}
                >
                  <Star
                    className={cn(
                      "size-9",
                      n <= rating
                        ? "fill-amber-400 text-amber-400"
                        : "text-muted-foreground/35",
                    )}
                  />
                </button>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="guest-name">Name (optional)</Label>
              <Input
                id="guest-name"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                className="h-11 rounded-xl"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="comment">Kommentar (optional)</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
              />
            </div>
            <Button
              type="button"
              className="h-11 w-full"
              disabled={busy || rating < 1}
              onClick={() => void submit()}
            >
              {busy ? "Senden…" : "Bewertung absenden"}
            </Button>
          </CardContent>
        ) : null}
      </Card>
    </div>
  );
}
