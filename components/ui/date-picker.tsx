"use client"

import * as React from "react"
import { format, isValid, parseISO } from "date-fns"
import { de } from "date-fns/locale"
import { de as localeDe } from "react-day-picker/locale"
import { Calendar as CalendarIcon, ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverPortal,
  PopoverPositioner,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

/**
 * Native `type="time"`: Mausklicks setzen oft nur `:focus`, nicht `:focus-visible`.
 * `focus:*` ergänzt die Standard-`Input`-Fokusdarstellung (`focus-visible:*`), damit Maus
 * dieselbe Border + Ring wie Tastatur sieht.
 */
export const formScheduleTimeInputClassName = cn(
  "h-11 w-[7.75rem] shrink-0 rounded-xl border border-input bg-transparent px-2.5 py-1 text-base tabular-nums transition-colors outline-none",
  "placeholder:text-muted-foreground",
  "focus:border-ring focus:ring-3 focus:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 md:text-sm dark:bg-input/30 dark:disabled:bg-input/80",
)

function parseYmdToDate(ymd: string | null | undefined): Date | undefined {
  if (!ymd?.trim()) return undefined
  const d = parseISO(`${ymd}T12:00:00`)
  return isValid(d) ? d : undefined
}

export function DatePickerField({
  value,
  onChange,
  disabled,
  placeholder = "Datum wählen",
  id,
  className,
  size = "default",
  fullWidth = false,
}: {
  value: string | null | undefined
  onChange: (ymd: string | null) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
  size?: "default" | "compact"
  /** Trigger füllt die verfügbare Breite (z. B. in `sm:grid-cols-2`). */
  fullWidth?: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const selected = React.useMemo(() => parseYmdToDate(value ?? null), [value])
  const hasDate = Boolean(value?.trim())

  /** Kurzes lokales Datum — passt zur schmalen shadcn-Triggerbreite. */
  const labelText = selected
    ? format(selected, "P", { locale: de })
    : placeholder

  const compact = size === "compact"

  return (
    <div
      className={cn(
        "[contain:layout] flex min-w-0",
        fullWidth ? "w-full" : "w-fit max-w-full shrink-0",
      )}
    >
      <Popover open={open} onOpenChange={setOpen} modal={false}>
        <PopoverTrigger
          id={id}
          disabled={disabled}
          type="button"
          render={
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              data-empty={!hasDate}
              className={cn(
                "h-11 shrink-0 justify-between gap-2 rounded-xl border border-input bg-transparent px-3 text-left text-sm font-normal shadow-none",
                fullWidth ? "w-full" : "w-[240px]",
                "text-foreground outline-none transition-colors",
                "hover:bg-muted/50 dark:bg-input/30 dark:hover:bg-input/40",
                "focus:border-ring focus:ring-3 focus:ring-ring/50 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                "data-[popup-open]:border-ring data-[popup-open]:ring-3 data-[popup-open]:ring-ring/50",
                "disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:disabled:bg-input/80",
                "active:!translate-y-0",
                open && "border-ring ring-3 ring-ring/50",
                compact && "h-9 w-[200px]",
                !hasDate && "text-muted-foreground",
                className,
              )}
            />
          }
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarIcon
              className="size-4 shrink-0 text-muted-foreground"
              aria-hidden
            />
            <span className="truncate">{labelText}</span>
          </span>
          <ChevronDownIcon
            className="size-4 shrink-0 text-muted-foreground opacity-70"
            aria-hidden
          />
        </PopoverTrigger>
        <PopoverPortal>
          <PopoverPositioner
            side="bottom"
            align="start"
            sideOffset={8}
            positionMethod="fixed"
          >
            <PopoverContent
              initialFocus={false}
              className="w-auto overflow-visible rounded-2xl border border-border/60 bg-popover p-0 shadow-none ring-1 ring-black/5 dark:shadow-xl dark:ring-white/10"
            >
              <Calendar
                className="rounded-2xl p-3"
                locale={localeDe}
                mode="single"
                /* Kein captionLayout="dropdown": native <select>-Listen liegen außerhalb des Popover-DOM;
                   Floating UI wertet Klicks/Fokus dann oft als "outside" — UI wirkt eingefroren. */
                startMonth={new Date(2020, 0)}
                endMonth={new Date(2035, 11)}
                selected={selected}
                defaultMonth={selected}
                onSelect={(d) => {
                  onChange(d ? format(d, "yyyy-MM-dd") : null)
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </PopoverPositioner>
        </PopoverPortal>
      </Popover>
    </div>
  )
}
