"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type MenuSearchFiltersProps = {
  search: string;
  onSearchChange: (value: string) => void;
  placeholder?: string;
};

export function MenuSearchFilters({
  search,
  onSearchChange,
  placeholder = "Gerichte oder Zutaten suchen",
}: MenuSearchFiltersProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        id="menu-search"
        type="search"
        placeholder={placeholder}
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="h-12 rounded-2xl border-border/50 bg-card pl-11 text-base shadow-none dark:shadow-sm"
        aria-label="Suche"
      />
    </div>
  );
}
