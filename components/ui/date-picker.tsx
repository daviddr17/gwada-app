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
}: {
  value: string | null | undefined
  onChange: (ymd: string | null) => void
  disabled?: boolean
  placeholder?: string
  id?: string
  className?: string
  size?: "default" | "compact"
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
    <div className="[contain:layout] inline-flex w-fit max-w-full shrink-0">
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
                "shrink-0 gap-2 border border-input bg-background text-left font-normal shadow-sm",
                "h-9 w-[240px] justify-between px-3 text-sm",
                /* Kein Tailwind-ring: Button-Variante nutzt ring-3 außen — würde Layout unter dem Feld verschieben. */
                "!ring-0 !outline-none transition-[color,box-shadow,border-color,transform]",
                "focus-visible:border-ring focus-visible:shadow-[inset_0_0_0_2px_var(--ring)]",
                "data-[popup-open]:border-ring data-[popup-open]:bg-background data-[popup-open]:shadow-[inset_0_0_0_2px_var(--ring)] data-[popup-open]:dark:border-ring dark:data-[popup-open]:bg-input/30",
                "active:!translate-y-0",
                open &&
                  "border-ring shadow-[inset_0_0_0_2px_var(--ring)] dark:border-ring",
                compact && "h-9 w-[200px]",
                "rounded-md",
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
            <PopoverContent className="w-auto overflow-hidden rounded-md border border-border bg-popover p-0 shadow-md ring-0 dark:ring-0">
              <Calendar
                className="rounded-md p-3"
                locale={localeDe}
                mode="single"
                captionLayout="dropdown"
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
