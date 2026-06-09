"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";

type ShiftPlanSearchFieldProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

export function ShiftPlanSearchField({
  value,
  onChange,
  placeholder = "Mitarbeiter suchen …",
}: ShiftPlanSearchFieldProps) {
  return (
    <div className="relative">
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted-foreground"
        aria-hidden
      />
      <Input
        type="search"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-12 w-full rounded-2xl border-border/50 bg-card pl-11 text-base shadow-none dark:shadow-sm"
        aria-label="Mitarbeiter suchen"
      />
    </div>
  );
}
