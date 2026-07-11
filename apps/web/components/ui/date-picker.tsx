"use client"

import * as React from "react"
import { format, isValid } from "date-fns"
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
import { mobileFormControlFontClassName } from "@/lib/ui/mobile-form-control-font"
import { cn } from "@/lib/utils"

/**
 * Native `type="time"`: Mausklicks setzen oft nur `:focus`, nicht `:focus-visible`.
 * `focus:*` ergänzt die Standard-`Input`-Fokusdarstellung (`focus-visible:*`), damit Maus
 * dieselbe Border + Ring wie Tastatur sieht.
 *
 * Controlled time inputs: nicht bei jedem `onChange` erneut `.focus()` aufrufen — das
 * unterbricht die Segment-Eingabe (z. B. „12“ wird zu „02“).
 */
const formScheduleTimeInputBaseClassName = cn(
  "h-11 min-w-0 shrink-0 rounded-xl border border-input bg-transparent px-3 py-1 tabular-nums transition-colors outline-none shadow-none",
  mobileFormControlFontClassName,
  "placeholder:text-muted-foreground text-foreground",
  "hover:bg-muted/50 dark:bg-input/30 dark:hover:bg-input/40",
  "focus:border-ring focus:ring-3 focus:ring-ring/50",
  "disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 dark:disabled:bg-input/80",
)

/** Schmal (Schichtplan, Öffnungszeiten-Grid). */
export const formScheduleTimeInputClassName = cn(
  formScheduleTimeInputBaseClassName,
  "w-[7.75rem]",
)

/** Volle Spaltenbreite neben DatePicker in Drawer-Formularen. */
export const formScheduleTimeInputFullWidthClassName = cn(
  formScheduleTimeInputBaseClassName,
  "w-full",
)

const DATE_PICKER_DEFAULT_START_MONTH = new Date(1940, 0)
const DATE_PICKER_DEFAULT_END_MONTH = new Date(new Date().getFullYear() + 5, 11)

function parseYmdToDate(ymd: string | null | undefined): Date | undefined {
  if (!ymd?.trim()) return undefined
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim())
  if (!match) return undefined
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    !Number.isFinite(year) ||
    !Number.isFinite(month) ||
    !Number.isFinite(day) ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    return undefined
  }
  const d = new Date(year, month - 1, day)
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
  minYmd,
  startMonth = DATE_PICKER_DEFAULT_START_MONTH,
  endMonth = DATE_PICKER_DEFAULT_END_MONTH,
  /** Kalender-Start, wenn noch kein Wert gesetzt ist (z. B. Geburtsdatum → 1990). */
  fallbackMonth,
  open: openProp,
  onOpenChange,
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
  /** Frühestes wählbares Datum (`yyyy-MM-dd`, inklusive). */
  minYmd?: string | null
  /** Frühester Monat in Monats-/Jahres-Dropdowns. */
  startMonth?: Date
  /** Spätester Monat in Monats-/Jahres-Dropdowns. */
  endMonth?: Date
  /** Kalender-Start ohne gesetztes Datum (sonst heute). */
  fallbackMonth?: Date
  /** Optional controlled popover (z. B. schließen bei Tages-Pfeilen). */
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = openProp ?? uncontrolledOpen
  const setOpen = onOpenChange ?? setUncontrolledOpen
  const selected = React.useMemo(() => parseYmdToDate(value ?? null), [value])
  const minDate = React.useMemo(() => parseYmdToDate(minYmd ?? null), [minYmd])
  const hasDate = Boolean(value?.trim())
  const initialMonth = selected ?? minDate ?? fallbackMonth ?? new Date()

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
                "h-11 shrink-0 justify-between gap-2 rounded-xl border border-input bg-transparent px-3 text-left font-normal shadow-none",
                mobileFormControlFontClassName,
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
                captionLayout="dropdown"
                startMonth={startMonth}
                endMonth={endMonth}
                selected={selected}
                defaultMonth={initialMonth}
                disabled={minDate ? { before: minDate } : undefined}
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
