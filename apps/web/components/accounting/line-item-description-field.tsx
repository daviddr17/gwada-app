"use client";

import { useMemo, useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AccountingArticleRow } from "@/lib/types/accounting";
import { accountingFormControlClassName } from "@/lib/ui/accounting-form-styles";
import { cn } from "@/lib/utils";

type LineItemDescriptionFieldProps = {
  value: string;
  readOnly?: boolean;
  articles: AccountingArticleRow[];
  onNameChange: (name: string) => void;
  onArticleSelect: (article: AccountingArticleRow) => void;
};

export function LineItemDescriptionField({
  value,
  readOnly,
  articles,
  onNameChange,
  onArticleSelect,
}: LineItemDescriptionFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredArticles = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter((a) => a.name.toLowerCase().includes(q));
  }, [articles, query]);

  const showArticlePicker = !readOnly && articles.length > 0;

  if (!showArticlePicker) {
    return (
      <Input
        className={accountingFormControlClassName}
        value={value}
        readOnly={readOnly}
        placeholder="Bezeichnung"
        onChange={(e) => onNameChange(e.target.value)}
      />
    );
  }

  return (
    <div
      className={cn(
        accountingFormControlClassName,
        "flex items-center gap-0.5 overflow-hidden p-0 pl-3 pr-1",
      )}
    >
      <Input
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none focus-visible:border-transparent focus-visible:ring-0"
        value={value}
        placeholder="Bezeichnung"
        onChange={(e) => onNameChange(e.target.value)}
      />
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setQuery("");
        }}
        modal={false}
      >
        <PopoverTrigger
          type="button"
          nativeButton
          render={
            <button
              type="button"
              className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70"
              aria-label="Artikel auswählen"
            />
          }
        >
          <ChevronDownIcon className="size-3.5" aria-hidden />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner
            side="bottom"
            align="start"
            sideOffset={8}
            positionMethod="fixed"
            className="w-(--anchor-width) min-w-[14rem] max-w-[min(100vw-1.5rem,20rem)]"
          >
            <PopoverContent className="w-full p-0">
              <div className="border-b border-border/50 p-2">
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Artikel suchen …"
                  className="h-9 rounded-lg"
                  autoFocus
                />
              </div>
              <ul className="max-h-52 overflow-y-auto overscroll-contain p-1.5">
                {filteredArticles.length === 0 ? (
                  <li className="px-3 py-6 text-center text-sm text-muted-foreground">
                    Kein Artikel gefunden
                  </li>
                ) : (
                  filteredArticles.map((article) => (
                    <li key={article.id}>
                      <button
                        type="button"
                        className="flex w-full rounded-xl px-3 py-2.5 text-left text-sm hover:bg-muted/70"
                        onClick={() => {
                          onArticleSelect(article);
                          setOpen(false);
                          setQuery("");
                        }}
                      >
                        <span className="font-medium">{article.name}</span>
                      </button>
                    </li>
                  ))
                )}
              </ul>
            </PopoverContent>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>
    </div>
  );
}
