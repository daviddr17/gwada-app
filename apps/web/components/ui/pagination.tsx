import * as React from "react";
import { ChevronLeftIcon, ChevronRightIcon, MoreHorizontalIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button, buttonVariants } from "@/components/ui/button";

function Pagination({ className, ...props }: React.ComponentProps<"nav">) {
  return (
    <nav
      role="navigation"
      aria-label="Seitennavigation"
      className={cn("flex w-full justify-center", className)}
      {...props}
    />
  );
}

function PaginationContent({
  className,
  ...props
}: React.ComponentProps<"ul">) {
  return (
    <ul
      className={cn("flex flex-row flex-wrap items-center gap-1", className)}
      {...props}
    />
  );
}

function PaginationItem({ ...props }: React.ComponentProps<"li">) {
  return <li {...props} />;
}

type PaginationLinkProps = {
  isActive?: boolean;
} & Pick<React.ComponentProps<typeof Button>, "size"> &
  React.ComponentProps<"button">;

function PaginationLink({
  className,
  isActive,
  size = "icon",
  ...props
}: PaginationLinkProps) {
  return (
    <Button
      type="button"
      variant={isActive ? "outline" : "ghost"}
      size={size}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        size === "icon" && "size-9",
        isActive && "border-border bg-muted/50",
        className,
      )}
      {...props}
    />
  );
}

function PaginationPrevious({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      <ChevronLeftIcon className="size-4" />
      <span className="sr-only">Zurück</span>
    </Button>
  );
}

function PaginationNext({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      className={cn(
        "size-8 shrink-0 rounded-full text-muted-foreground hover:text-foreground",
        className,
      )}
      {...props}
    >
      <ChevronRightIcon className="size-4" />
      <span className="sr-only">Weiter</span>
    </Button>
  );
}

/** Kompakt: ‹ Seite 2/5 › — app-weit für Listen-Pagination. */
function PaginationPageControl({
  page,
  totalPages,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  busy = false,
  className,
}: {
  page: number;
  totalPages: number;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("flex shrink-0 items-center gap-0.5", className)}>
      <PaginationPrevious
        disabled={!canPrevious || busy}
        onClick={onPrevious}
        aria-label="Vorherige Seite"
      />
      <span className="min-w-[5.25rem] px-0.5 text-center text-sm tabular-nums text-muted-foreground">
        Seite {page}/{totalPages}
      </span>
      <PaginationNext
        disabled={!canNext || busy}
        onClick={onNext}
        aria-label="Nächste Seite"
      />
    </div>
  );
}

function PaginationEllipsis({
  className,
  ...props
}: React.ComponentProps<"span">) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex size-9 items-center justify-center text-muted-foreground",
        className,
      )}
      {...props}
    >
      <MoreHorizontalIcon className="size-4" />
    </span>
  );
}

export {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPageControl,
  PaginationPrevious,
  buttonVariants,
};
