"use client"

import * as React from "react"
import {
  DayPicker,
  getDefaultClassNames,
  type DayButton,
  type Locale,
  useDayPicker,
} from "react-day-picker"
import { de as localeDe } from "react-day-picker/locale"
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function CalendarPreviousMonthButton(props: React.ComponentProps<"button">) {
  const { children: _children, className, ...rest } = props
  const dir = useDayPicker().dayPickerProps.dir
  const Icon = dir === "rtl" ? ChevronRightIcon : ChevronLeftIcon
  return (
    <button className={cn(className)} {...rest}>
      <Icon className="size-4 shrink-0" aria-hidden />
    </button>
  )
}

function CalendarNextMonthButton(props: React.ComponentProps<"button">) {
  const { children: _children, className, ...rest } = props
  const dir = useDayPicker().dayPickerProps.dir
  const Icon = dir === "rtl" ? ChevronLeftIcon : ChevronRightIcon
  return (
    <button className={cn(className)} {...rest}>
      <Icon className="size-4 shrink-0" aria-hidden />
    </button>
  )
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  captionLayout = "label",
  locale = localeDe,
  formatters,
  components,
  navLayout: navLayoutProp,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  const defaultClassNames = getDefaultClassNames()
  /** Default nav is absolutely positioned and sits on top of the caption — native month/year selects never receive clicks. */
  const navLayout =
    navLayoutProp ??
    (typeof captionLayout === "string" && captionLayout.startsWith("dropdown")
      ? ("around" as const)
      : undefined)
  const captionUsesDropdown =
    typeof captionLayout === "string" && captionLayout.startsWith("dropdown")

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      navLayout={navLayout}
      className={cn(
        "group/calendar bg-background p-3 [--cell-radius:var(--radius-md)] [--cell-size:2.25rem] in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
        String.raw`rtl:**:[.rdp-button\_next>svg]:rotate-180`,
        String.raw`rtl:**:[.rdp-button\_previous>svg]:rotate-180`,
        className,
      )}
      captionLayout={captionLayout}
      locale={locale}
      formatters={{
        formatMonthDropdown: (date) =>
          date.toLocaleString(locale?.code ?? "de-DE", { month: "short" }),
        ...formatters,
      }}
      classNames={{
        root: cn("w-fit", defaultClassNames.root),
        months: cn(
          "relative flex flex-col gap-4 md:flex-row",
          defaultClassNames.months,
        ),
        month: cn("flex w-full flex-col gap-4", defaultClassNames.month),
        nav: cn(
          "absolute inset-x-0 top-0 z-20 flex w-full items-center justify-between gap-1 px-0.5",
          defaultClassNames.nav,
        ),
        button_previous: cn(
          "inline-flex size-(--cell-size) shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground shadow-none outline-none select-none",
          "hover:bg-muted/80 hover:text-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-disabled:pointer-events-none aria-disabled:opacity-50",
          defaultClassNames.button_previous,
        ),
        button_next: cn(
          "inline-flex size-(--cell-size) shrink-0 items-center justify-center rounded-md border-0 bg-transparent p-0 text-muted-foreground shadow-none outline-none select-none",
          "hover:bg-muted/80 hover:text-foreground",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "aria-disabled:pointer-events-none aria-disabled:opacity-50",
          defaultClassNames.button_next,
        ),
        month_caption: cn(
          "flex h-(--cell-size) w-full items-center justify-center",
          captionUsesDropdown ? "px-0" : "px-(--cell-size)",
          defaultClassNames.month_caption,
        ),
        dropdowns: cn(
          "relative mx-auto flex h-(--cell-size) w-fit max-w-full shrink-0 items-center justify-center gap-1.5 text-sm font-medium",
          defaultClassNames.dropdowns,
        ),
        dropdown_root: cn(
          "border-input bg-background relative rounded-md border shadow-xs outline-none hover:bg-muted/60 focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/45 dark:border-input dark:bg-input/30",
          defaultClassNames.dropdown_root,
        ),
        dropdown: cn(
          "bg-popover absolute inset-0 cursor-pointer opacity-0",
          defaultClassNames.dropdown,
        ),
        caption_label: cn(
          "select-none font-medium",
          captionLayout === "label"
            ? "text-sm"
            : "flex h-8 items-center gap-1 rounded-md pl-2 pr-1 text-sm [&>svg]:size-3.5 [&>svg]:text-muted-foreground",
          defaultClassNames.caption_label,
        ),
        month_grid: cn(
          "w-full border-collapse",
          defaultClassNames.month_grid,
        ),
        weekdays: cn(defaultClassNames.weekdays),
        weekday: cn(
          "text-muted-foreground h-8 w-9 p-0 text-center align-middle text-[0.8rem] font-normal",
          defaultClassNames.weekday,
        ),
        week: cn(defaultClassNames.week),
        week_number_header: cn(
          "w-(--cell-size) select-none",
          defaultClassNames.week_number_header,
        ),
        week_number: cn(
          "text-muted-foreground select-none text-[0.8rem]",
          defaultClassNames.week_number,
        ),
        day: cn(
          "group/day relative p-0 text-center align-middle text-sm select-none [&:first-child[data-selected=true]_button]:rounded-l-md [&:last-child[data-selected=true]_button]:rounded-r-md",
          defaultClassNames.day,
        ),
        range_start: cn(
          "bg-muted relative isolate z-0 rounded-l-md",
          defaultClassNames.range_start,
        ),
        range_middle: cn("rounded-none", defaultClassNames.range_middle),
        range_end: cn(
          "bg-muted relative isolate z-0 rounded-r-md",
          defaultClassNames.range_end,
        ),
        today: cn(
          "rounded-md data-[selected=true]:rounded-none",
          defaultClassNames.today,
        ),
        outside: cn(
          "text-muted-foreground/70 aria-selected:text-muted-foreground",
          defaultClassNames.outside,
        ),
        disabled: cn(
          "text-muted-foreground opacity-50",
          defaultClassNames.disabled,
        ),
        hidden: cn("invisible", defaultClassNames.hidden),
        ...classNames,
      }}
      components={{
        Root: ({ className: rootClassName, rootRef, ...rootProps }) => (
          <div
            data-slot="calendar"
            ref={rootRef}
            className={cn(rootClassName)}
            {...rootProps}
          />
        ),
        PreviousMonthButton: CalendarPreviousMonthButton,
        NextMonthButton: CalendarNextMonthButton,
        Chevron: ({ className: chClassName, orientation, ...chProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeftIcon
                className={cn("size-4", chClassName)}
                {...chProps}
              />
            )
          }
          if (orientation === "right") {
            return (
              <ChevronRightIcon
                className={cn("size-4", chClassName)}
                {...chProps}
              />
            )
          }
          return (
            <ChevronDownIcon className={cn("size-4", chClassName)} {...chProps} />
          )
        },
        DayButton: (dayButtonProps) => (
          <CalendarDayButton locale={locale} {...dayButtonProps} />
        ),
        WeekNumber: ({ children, ...weekProps }) => (
          <td {...weekProps}>
            <div className="flex size-(--cell-size) items-center justify-center text-center">
              {children}
            </div>
          </td>
        ),
        ...components,
      }}
      {...props}
    />
  )
}

function CalendarDayButton({
  className,
  day,
  modifiers,
  locale,
  ...props
}: React.ComponentProps<typeof DayButton> & { locale?: Partial<Locale> }) {
  const defaultClassNames = getDefaultClassNames()
  const ref = React.useRef<HTMLButtonElement>(null)
  React.useEffect(() => {
    if (modifiers.focused) ref.current?.focus()
  }, [modifiers.focused])

  return (
    <Button
      ref={ref}
      variant="ghost"
      size="icon"
      data-day={day.date.toLocaleDateString(locale?.code ?? "de")}
      data-today={modifiers.today ? "" : undefined}
      data-selected-single={
        modifiers.selected &&
        !modifiers.range_start &&
        !modifiers.range_end &&
        !modifiers.range_middle
      }
      data-range-start={modifiers.range_start}
      data-range-end={modifiers.range_end}
      data-range-middle={modifiers.range_middle}
      className={cn(
        "relative z-10 flex size-9 min-w-9 flex-col gap-1 border-0 p-0 font-normal leading-none",
        "text-foreground hover:bg-muted/80 hover:text-foreground",
        "data-[range-start=true]:rounded-l-md data-[range-start=true]:bg-primary data-[range-start=true]:text-primary-foreground",
        "data-[range-end=true]:rounded-r-md data-[range-end=true]:bg-primary data-[range-end=true]:text-primary-foreground",
        "data-[range-middle=true]:rounded-none data-[range-middle=true]:bg-muted data-[range-middle=true]:text-foreground",
        "group-data-[focused=true]/day:border-ring group-data-[focused=true]/day:ring-[3px] group-data-[focused=true]/day:ring-ring/50",
        "[&>span]:text-xs [&>span]:opacity-70",
        defaultClassNames.day_button,
        /* Heute: größere, kräftigere Zahl (früher eher „gewählt“-Optik) */
        "data-[today]:text-[15px] data-[today]:font-semibold data-[today]:tabular-nums data-[today]:tracking-wide",
        /* Gewählter Tag: muted-Fläche (früher „Heute“-Optik) */
        "data-[selected-single=true]:bg-muted data-[selected-single=true]:text-foreground data-[selected-single=true]:hover:bg-muted/80 data-[selected-single=true]:hover:text-foreground",
        className,
      )}
      {...props}
    />
  )
}

export { Calendar, CalendarDayButton }
