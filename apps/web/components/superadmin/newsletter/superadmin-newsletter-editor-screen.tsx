"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Eye,
  ImagePlus,
  Plus,
  Send,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { useDeferredSkeleton } from "@/lib/hooks/use-deferred-skeleton";
import {
  datetimeLocalToIso,
  isoToDatetimeLocal,
} from "@/lib/changelog/changelog-format";
import {
  duplicateSuperadminNewsletter,
  fetchNewsletterChangelogSuggestions,
  fetchSuperadminNewsletterDetail,
  previewSuperadminNewsletter,
  saveSuperadminNewsletter,
  scheduleSuperadminNewsletter,
  testSuperadminNewsletter,
  uploadNewsletterBlockImage,
} from "@/lib/superadmin/platform-newsletter-api";
import type { PlatformChangelogEntry } from "@/lib/types/platform-changelog";
import { brandActionButtonRoundedClassName } from "@/lib/ui/brand-action-button";
import { NewsletterPreviewDrawer } from "@/components/superadmin/newsletter/newsletter-preview-drawer";
import { parseChangelogBody } from "@/lib/changelog/changelog-body-sections";

type DraftBlock = {
  key: string;
  heading: string;
  body: string;
  imagePath: string | null;
  imageAlt: string | null;
  imageUrl: string | null;
};

function newBlock(): DraftBlock {
  return {
    key: crypto.randomUUID(),
    heading: "",
    body: "",
    imagePath: null,
    imageAlt: null,
    imageUrl: null,
  };
}

export function SuperadminNewsletterEditorScreen({
  newsletterId,
}: {
  newsletterId: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [isTemplate, setIsTemplate] = useState(false);
  const [status, setStatus] = useState("draft");
  const [blocks, setBlocks] = useState<DraftBlock[]>([newBlock()]);
  const [scheduledLocal, setScheduledLocal] = useState("");
  const [testEmail, setTestEmail] = useState("");
  const [suggestions, setSuggestions] = useState<PlatformChangelogEntry[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [previewSubject, setPreviewSubject] = useState("");
  const showSkeleton = useDeferredSkeleton(loading);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ item, error }, sug] = await Promise.all([
      fetchSuperadminNewsletterDetail(newsletterId),
      fetchNewsletterChangelogSuggestions(),
    ]);
    if (error || !item) {
      toast.error(error ?? "Nicht gefunden");
      setLoading(false);
      return;
    }
    setTitle(item.title);
    setSubject(item.subject);
    setPreheader(item.preheader ?? "");
    setIsTemplate(item.isTemplate);
    setStatus(item.status);
    setScheduledLocal(
      item.scheduledAt ? isoToDatetimeLocal(item.scheduledAt) : "",
    );
    setBlocks(
      item.blocks.length > 0
        ? item.blocks.map((b) => ({
            key: b.id,
            heading: b.heading,
            body: b.body,
            imagePath: b.imagePath,
            imageAlt: b.imageAlt,
            imageUrl: b.imageUrl,
          }))
        : [newBlock()],
    );
    setSuggestions(sug.entries);
    setLoading(false);
  }, [newsletterId]);

  useEffect(() => {
    void load();
  }, [load]);

  const locked = status === "sending" || status === "sent";

  const save = async () => {
    setSaving(true);
    const res = await saveSuperadminNewsletter(newsletterId, {
      title,
      subject,
      preheader: preheader || null,
      blocks: blocks.map((b) => ({
        heading: b.heading,
        body: b.body,
        imagePath: b.imagePath,
        imageAlt: b.imageAlt,
      })),
    });
    setSaving(false);
    if (res.error) {
      toast.error(res.error);
      return false;
    }
    toast.success("Gespeichert");
    return true;
  };

  const openPreview = async () => {
    const ok = locked ? true : await save();
    if (!ok && !locked) return;
    const res = await previewSuperadminNewsletter(newsletterId);
    if (res.error || !res.html) {
      toast.error(res.error ?? "Vorschau fehlgeschlagen");
      return;
    }
    setPreviewHtml(res.html);
    setPreviewSubject(res.subject ?? subject);
    setPreviewOpen(true);
  };

  const addChangelogPoint = (entry: PlatformChangelogEntry) => {
    const { customerBody } = parseChangelogBody(entry.body);
    const body =
      entry.audience === "superadmin" ? entry.body : customerBody || entry.body;
    setBlocks((prev) => [
      ...prev,
      {
        key: crypto.randomUUID(),
        heading: entry.title,
        body: body.trim(),
        imagePath: null,
        imageAlt: null,
        imageUrl: null,
      },
    ]);
    toast.success(
      entry.approvedAt ? "Punkt übernommen" : "Punkt übernommen (pending)",
    );
  };

  if (showSkeleton) {
    return <Skeleton className="mt-2 h-96 w-full rounded-xl" />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="rounded-full"
          onClick={() =>
            router.push(
              isTemplate
                ? "/superadmin/newsletter/vorlagen"
                : "/superadmin/newsletter",
            )
          }
        >
          <ArrowLeft className="size-3.5" />
          Zurück
        </Button>
        <span className="text-xs text-muted-foreground">
          {isTemplate ? "Vorlage" : status}
        </span>
      </div>

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Meta</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <Label>Interner Titel</Label>
            <Input
              value={title}
              disabled={locked}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Betreff (E-Mail)</Label>
            <Input
              value={subject}
              disabled={locked}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label>Preheader (optional)</Label>
            <Input
              value={preheader}
              disabled={locked}
              onChange={(e) => setPreheader(e.target.value)}
              className="h-10 rounded-xl"
            />
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {blocks.map((block, index) => (
          <Card key={block.key} className="border-border/50 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
              <CardTitle className="text-base font-semibold">
                Punkt {index + 1}
              </CardTitle>
              {!locked ? (
                <Button
                  type="button"
                  size="icon-sm"
                  variant="outline"
                  className="rounded-full"
                  disabled={blocks.length <= 1}
                  onClick={() =>
                    setBlocks((prev) => prev.filter((b) => b.key !== block.key))
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1.5">
                <Label>Überschrift</Label>
                <Input
                  value={block.heading}
                  disabled={locked}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((b) =>
                        b.key === block.key
                          ? { ...b, heading: e.target.value }
                          : b,
                      ),
                    )
                  }
                  className="h-10 rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Inhalt</Label>
                <Textarea
                  value={block.body}
                  disabled={locked}
                  rows={5}
                  onChange={(e) =>
                    setBlocks((prev) =>
                      prev.map((b) =>
                        b.key === block.key
                          ? { ...b, body: e.target.value }
                          : b,
                      ),
                    )
                  }
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-2">
                <Label>Bild (optional, max. 1)</Label>
                {block.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={block.imageUrl}
                    alt={block.imageAlt || block.heading || "Newsletter"}
                    className="max-h-48 w-full rounded-xl object-cover"
                  />
                ) : null}
                {!locked ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="rounded-full"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/png,image/jpeg,image/webp";
                        input.onchange = () => {
                          const file = input.files?.[0];
                          if (!file) return;
                          void (async () => {
                            const res = await uploadNewsletterBlockImage(
                              newsletterId,
                              file,
                            );
                            if (res.error || !res.path) {
                              toast.error(res.error ?? "Upload fehlgeschlagen");
                              return;
                            }
                            setBlocks((prev) =>
                              prev.map((b) =>
                                b.key === block.key
                                  ? {
                                      ...b,
                                      imagePath: res.path!,
                                      imageUrl: res.url ?? null,
                                    }
                                  : b,
                              ),
                            );
                          })();
                        };
                        input.click();
                      }}
                    >
                      <ImagePlus className="size-3.5" />
                      Bild hochladen
                    </Button>
                    {block.imagePath ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() =>
                          setBlocks((prev) =>
                            prev.map((b) =>
                              b.key === block.key
                                ? {
                                    ...b,
                                    imagePath: null,
                                    imageUrl: null,
                                    imageAlt: null,
                                  }
                                : b,
                            ),
                          )
                        }
                      >
                        Bild entfernen
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </CardContent>
          </Card>
        ))}

        {!locked ? (
          <Button
            type="button"
            variant="outline"
            className="w-full rounded-xl"
            onClick={() => setBlocks((prev) => [...prev, newBlock()])}
          >
            <Plus className="size-4" />
            Punkt hinzufügen
          </Button>
        ) : null}
      </div>

      {suggestions.length > 0 && !locked ? (
        <Card className="border-border/50 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">
              Changelog-Vorschläge
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {suggestions.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="flex w-full items-start justify-between gap-3 rounded-xl border border-border/50 px-3 py-2.5 text-left hover:bg-muted/30"
                onClick={() => addChangelogPoint(entry)}
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium">{entry.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {parseChangelogBody(entry.body).customerBody || entry.body}
                  </p>
                </div>
                {!entry.approvedAt ? (
                  <span className="shrink-0 rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                    pending
                  </span>
                ) : (
                  <span className="shrink-0 text-[10px] text-muted-foreground">
                    + übernehmen
                  </span>
                )}
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="border-border/50 shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Aktionen</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className={brandActionButtonRoundedClassName}
              disabled={saving || locked}
              onClick={() => void save()}
            >
              Speichern
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => void openPreview()}
            >
              <Eye className="size-3.5" />
              Vorschau
            </Button>
            {!isTemplate ? (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  void (async () => {
                    const ok = await save();
                    if (!ok) return;
                    const res = await duplicateSuperadminNewsletter(
                      newsletterId,
                      { asTemplate: true },
                    );
                    if (res.error) {
                      toast.error(res.error);
                      return;
                    }
                    toast.success("Als Vorlage gespeichert");
                  })()
                }
              >
                Als Vorlage
              </Button>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="rounded-full"
                onClick={() =>
                  void (async () => {
                    const res = await duplicateSuperadminNewsletter(
                      newsletterId,
                      { asTemplate: false },
                    );
                    if (res.error || !res.id) {
                      toast.error(res.error ?? "Kopieren fehlgeschlagen");
                      return;
                    }
                    router.push(`/superadmin/newsletter/${res.id}`);
                  })()
                }
              >
                Als Newsletter kopieren
              </Button>
            )}
          </div>

          {!isTemplate && !locked ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Testmail an</Label>
                  <Input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="name@beispiel.de"
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full rounded-full"
                    onClick={() =>
                      void (async () => {
                        const ok = await save();
                        if (!ok) return;
                        if (!testEmail.trim()) {
                          toast.error("E-Mail angeben");
                          return;
                        }
                        const res = await testSuperadminNewsletter(
                          newsletterId,
                          testEmail,
                        );
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success("Testmail gesendet");
                      })()
                    }
                  >
                    <Send className="size-3.5" />
                    Test senden
                  </Button>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Senden am (leer = sofort)</Label>
                  <Input
                    type="datetime-local"
                    value={scheduledLocal}
                    onChange={(e) => setScheduledLocal(e.target.value)}
                    className="h-10 rounded-xl"
                  />
                </div>
                <div className="flex items-end">
                  <Button
                    type="button"
                    className={brandActionButtonRoundedClassName}
                    onClick={() =>
                      void (async () => {
                        const ok = await save();
                        if (!ok) return;
                        if (
                          !confirm(
                            scheduledLocal
                              ? "Newsletter zum geplanten Zeitpunkt an alle Abonnenten senden?"
                              : "Newsletter jetzt an alle Abonnenten einreihen?",
                          )
                        ) {
                          return;
                        }
                        const res = await scheduleSuperadminNewsletter(
                          newsletterId,
                          scheduledLocal
                            ? datetimeLocalToIso(scheduledLocal)
                            : null,
                        );
                        if (res.error) {
                          toast.error(res.error);
                          return;
                        }
                        toast.success(
                          `${res.recipientCount ?? 0} Empfänger eingereiht`,
                        );
                        void load();
                      })()
                    }
                  >
                    <Send className="size-3.5" />
                    {scheduledLocal ? "Planen" : "Jetzt senden"}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <NewsletterPreviewDrawer
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        subject={previewSubject}
        html={previewHtml}
      />
    </div>
  );
}
