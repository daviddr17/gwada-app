"use client"

import * as React from "react"
import { Combobox } from "@base-ui/react/combobox"

import { useDrawerFloatingPortalHost } from "@/lib/contexts/drawer-floating-portal"
import { cn } from "@/lib/utils"
import { labelForTagId } from "@/lib/constants/menu-labels"
import { getTagChipVisual } from "@/lib/utils/tag-styles"
import type { MenuTag, MenuTaxonomyDefinition } from "@/lib/types/menu"
import { ContactPlatformIcon } from "@/components/contacts/contact-platform-icon"
import type { ContactCatalogPlatform } from "@/lib/constants/contact-catalog-platforms"
import { CheckIcon, ChevronDownIcon, Plus } from "lucide-react"

const collisionDefaults = {
  side: "flip" as const,
  align: "shift" as const,
  fallbackAxisSide: "none" as const,
}

export type SearchableSelectOption = {
  value: string
  label: string
  disabled?: boolean
  /** z. B. Tag-Farbe als linker Streifen */
  leadingColor?: string
  /** z. B. Gwada / Lexware vor dem Label */
  leadingPlatforms?: readonly ContactCatalogPlatform[]
}

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/

function TagColorStripe({ color }: { color?: string }) {
  if (!color || !HEX_COLOR.test(color)) return null
  return (
    <span
      className="mr-1.5 h-5 w-1 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden
    />
  )
}

function OptionLeadingPlatforms({
  platforms,
}: {
  platforms?: readonly ContactCatalogPlatform[]
}) {
  if (!platforms?.length) return null
  return (
    <span className="mr-1.5 inline-flex shrink-0 items-center gap-0.5">
      {platforms.map((platform) => (
        <ContactPlatformIcon key={platform} platform={platform} />
      ))}
    </span>
  )
}

export type SearchableSelectFooterAction = {
  label: string
  onSelect: () => void
}

export type SearchableSelectProps = {
  options: SearchableSelectOption[]
  value: string | null
  onValueChange: (v: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  disabled?: boolean
  className?: string
  id?: string
  footerAction?: SearchableSelectFooterAction
  "aria-invalid"?: boolean
  "aria-label"?: string
}

/**
 * Single-select with typeahead (Base UI Combobox). Shows **labels**, values are opaque IDs.
 * Safe inside drawers: `modal={false}`, fixed positioning, high z-index.
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = "Auswählen…",
  searchPlaceholder = "Suchen…",
  emptyText = "Kein Treffer",
  disabled,
  className,
  id,
  footerAction,
  "aria-invalid": ariaInvalid,
  "aria-label": ariaLabel,
}: SearchableSelectProps) {
  const drawerFloatingHost = useDrawerFloatingPortalHost()
  const [open, setOpen] = React.useState(false)

  const optionValues = React.useMemo(
    () => options.map((o) => o.value),
    [options],
  )
  const optionByValue = React.useMemo(() => {
    const m = new Map<string, SearchableSelectOption>()
    for (const o of options) m.set(o.value, o)
    return m
  }, [options])

  const labelById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const o of options) m.set(o.value, o.label)
    return m
  }, [options])

  const colorById = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const o of options) {
      if (o.leadingColor && HEX_COLOR.test(o.leadingColor)) {
        m.set(o.value, o.leadingColor)
      }
    }
    return m
  }, [options])

  const platformsById = React.useMemo(() => {
    const m = new Map<string, readonly ContactCatalogPlatform[]>()
    for (const o of options) {
      if (o.leadingPlatforms?.length) {
        m.set(o.value, o.leadingPlatforms)
      }
    }
    return m
  }, [options])

  const selectedLeadingColor = value ? colorById.get(value) : undefined
  const selectedLeadingPlatforms = value
    ? platformsById.get(value)
    : undefined

  const displayLabel = value ? (labelById.get(value) ?? "") : ""
  const [inputValue, setInputValue] = React.useState(displayLabel)
  React.useEffect(() => {
    setInputValue(displayLabel)
  }, [displayLabel])

  const matcher = Combobox.useFilter({
    sensitivity: "base",
    // Einfaches „enthält“-Matching — ohne Sonderfall „Auswahl = Query → alle Items“.
    multiple: true,
  })

  return (
    <Combobox.Root
      modal={false}
      open={open}
      onOpenChange={setOpen}
      value={value}
      inputValue={inputValue}
      onInputValueChange={(next) => setInputValue(next)}
      onValueChange={(v) => {
        if (typeof v === "string") onValueChange(v)
        else onValueChange("")
      }}
      items={optionValues}
      itemToStringLabel={(id) => labelById.get(id) ?? id}
      filter={(id, query, toStr) =>
        query.trim() === "" ||
        matcher.contains(id, query, toStr as (item: string) => string)
      }
      autoHighlight={true}
      disabled={disabled}
    >
      <Combobox.InputGroup
        data-slot="searchable-select-trigger"
        title={placeholder}
        className={cn(
          "flex min-h-11 w-full min-w-0 touch-manipulation items-center gap-0.5 rounded-2xl border border-border/70 bg-card px-2 py-1 shadow-none transition-[border-color,box-shadow] outline-none hover:border-border focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/45 dark:border-border/80 dark:bg-input/25 dark:shadow-sm",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        {selectedLeadingPlatforms?.length ? (
          <OptionLeadingPlatforms platforms={selectedLeadingPlatforms} />
        ) : (
          <TagColorStripe color={selectedLeadingColor} />
        )}
        <Combobox.Input
          id={id}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          placeholder={searchPlaceholder}
          className={cn(
            "min-h-9 min-w-0 flex-1 border-0 bg-transparent px-1 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus-visible:ring-0 sm:text-sm",
            "truncate",
            "data-[popup-open]:overflow-x-auto data-[popup-open]:overflow-y-hidden data-[popup-open]:text-clip",
          )}
        />
        <Combobox.Trigger
          className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/70"
          aria-label="Liste öffnen"
        >
          <ChevronDownIcon className="size-3.5" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal container={drawerFloatingHost ?? undefined}>
        <Combobox.Positioner
          className="pointer-events-auto isolate z-[320] outline-none"
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          collisionAvoidance={collisionDefaults}
          sticky
          positionMethod="fixed"
        >
          <Combobox.Popup
            className={cn(
              "pointer-events-auto max-h-[min(var(--available-height),22rem)] w-(--anchor-width) max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-none ring-1 ring-black/5 dark:shadow-xl dark:ring-white/10",
              "data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
            )}
          >
            <Combobox.List className="max-h-[min(var(--available-height),20rem)] scroll-py-2 overflow-y-auto overscroll-contain px-1.5 py-2 outline-none">
              {(id) => {
                const o = optionByValue.get(id)
                if (!o) return null
                return (
                  <Combobox.Item
                    key={id}
                    value={id}
                    disabled={o.disabled}
                    className={cn(
                      "pointer-events-auto relative flex min-h-11 cursor-default items-center rounded-xl py-2.5 pr-10 pl-3 text-[15px] text-popover-foreground outline-none select-none hover:bg-muted/70 hover:text-foreground data-disabled:pointer-events-none data-disabled:opacity-45 data-highlighted:bg-muted/80 data-highlighted:text-foreground data-selected:bg-accent/12 data-selected:text-foreground sm:min-h-10 sm:text-sm [&>span:first-child]:shrink-0",
                    )}
                  >
                    <OptionLeadingPlatforms platforms={o.leadingPlatforms} />
                    <TagColorStripe color={o.leadingColor} />
                    <span className="flex-1 whitespace-normal break-words">
                      {o.label}
                    </span>
                    <Combobox.ItemIndicator className="pointer-events-none absolute right-2.5 top-1/2 flex size-4 -translate-y-1/2 text-accent">
                      <CheckIcon className="size-4" aria-hidden />
                    </Combobox.ItemIndicator>
                  </Combobox.Item>
                )
              }}
            </Combobox.List>
            {footerAction ? (
              <>
                <Combobox.Separator className="mx-1.5 bg-border/60" />
                <div className="px-1.5 pb-2">
                  <button
                    type="button"
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-medium text-accent outline-none hover:bg-muted/70 sm:min-h-10 sm:text-sm"
                    onClick={() => {
                      setOpen(false)
                      footerAction.onSelect()
                    }}
                  >
                    <Plus className="size-4 shrink-0" aria-hidden />
                    {footerAction.label}
                  </button>
                </div>
              </>
            ) : null}
            <Combobox.Empty className="empty:hidden min-h-0 px-4 py-8 text-center text-sm text-muted-foreground">
              {emptyText}
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}

export type TagMultiComboboxProps = {
  definitions: MenuTaxonomyDefinition[]
  value: MenuTag[]
  onChange: (tags: MenuTag[]) => void
  disabled?: boolean
  className?: string
  id?: string
  "aria-label"?: string
}

/**
 * Multi-select tags with chips + search (Allergene / Eigenschaften).
 */
export function TagMultiCombobox({
  definitions,
  value,
  onChange,
  disabled,
  className,
  id,
  "aria-label": ariaLabel,
}: TagMultiComboboxProps) {
  const drawerFloatingHost = useDrawerFloatingPortalHost()

  const available = React.useMemo(
    () =>
      definitions
        .filter((d) => d.active !== false && !value.includes(d.id))
        .map((d) => d.id),
    [definitions, value],
  )

  const matcher = Combobox.useFilter({
    sensitivity: "base",
    multiple: true,
    value,
  })

  return (
    <Combobox.Root
      modal={false}
      multiple
      value={value}
      onValueChange={(v) => {
        if (Array.isArray(v)) onChange(v as MenuTag[])
        else onChange([])
      }}
      items={available}
      itemToStringLabel={(t) => labelForTagId(t, definitions)}
      filter={(t, query, toStr) =>
        query.trim() === "" ||
        matcher.contains(t, query, toStr as (item: MenuTag) => string)
      }
      autoHighlight={true}
      disabled={disabled}
    >
      <Combobox.InputGroup
        id={id}
        aria-label={ariaLabel}
        data-slot="tag-multi-combobox"
        className={cn(
          "flex min-h-11 w-full min-w-0 touch-manipulation items-center gap-1.5 rounded-2xl border border-border/70 bg-card px-2 py-1.5 shadow-none transition-[border-color,box-shadow] outline-none focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/45 dark:border-border/80 dark:bg-input/25 dark:shadow-sm",
          disabled && "pointer-events-none opacity-50",
          className,
        )}
      >
        <Combobox.Chips className="flex min-h-8 min-w-0 flex-1 flex-wrap items-center gap-1.5">
          <Combobox.Value>
            {(selected: MenuTag[]) => (
              <>
                {selected.map((t) => {
                  const vis = getTagChipVisual(t, definitions)
                  return (
                  <Combobox.Chip
                    key={t}
                    className={cn(
                      "inline-flex max-w-full min-w-0 shrink items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold",
                      vis.className,
                    )}
                    style={vis.style}
                  >
                    <span className="min-w-0 truncate">{labelForTagId(t, definitions)}</span>
                    <Combobox.ChipRemove
                      className="rounded-full p-0.5 text-foreground/65 hover:bg-black/10 hover:text-foreground dark:hover:bg-white/10"
                      aria-label={`${labelForTagId(t, definitions)} entfernen`}
                    />
                  </Combobox.Chip>
                  )
                })}
                <Combobox.Input
                  placeholder={
                    selected.length ? "Weitere Tags suchen…" : "Tags suchen und hinzufügen…"
                  }
                  className={cn(
                    "min-h-8 min-w-0 max-w-full flex-[1_1_7rem] border-0 bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-0",
                    "truncate",
                    "data-[popup-open]:overflow-x-auto data-[popup-open]:overflow-y-hidden data-[popup-open]:text-clip",
                  )}
                />
              </>
            )}
          </Combobox.Value>
        </Combobox.Chips>
        <Combobox.Trigger
          className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/70"
          aria-label="Tag-Liste öffnen"
        >
          <ChevronDownIcon className="size-4" />
        </Combobox.Trigger>
      </Combobox.InputGroup>

      <Combobox.Portal container={drawerFloatingHost ?? undefined}>
        <Combobox.Positioner
          className="pointer-events-auto isolate z-[320] outline-none"
          side="bottom"
          align="start"
          sideOffset={8}
          collisionPadding={16}
          collisionAvoidance={collisionDefaults}
          sticky
          positionMethod="fixed"
        >
          <Combobox.Popup
            className={cn(
              "pointer-events-auto max-h-[min(var(--available-height),22rem)] w-(--anchor-width) max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-border/60 bg-popover text-popover-foreground shadow-none ring-1 ring-black/5 dark:shadow-xl dark:ring-white/10",
              "data-[side=bottom]:slide-in-from-top-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-[0.98] data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-[0.98]",
            )}
          >
            <Combobox.List className="max-h-60 scroll-py-2 overflow-y-auto overscroll-contain px-1.5 py-2 outline-none">
              {(t: MenuTag) => (
                <Combobox.Item
                  key={t}
                  value={t}
                  className="pointer-events-auto relative flex min-h-11 cursor-default items-center rounded-xl py-2.5 pr-10 pl-3 text-[15px] text-foreground outline-none select-none hover:bg-muted/70 data-highlighted:bg-muted/80 data-selected:bg-accent/12 data-selected:text-foreground sm:min-h-10 sm:text-sm"
                >
                  <span className="flex-1 font-medium">{labelForTagId(t, definitions)}</span>
                  <Combobox.ItemIndicator className="pointer-events-none absolute right-2.5 top-1/2 flex size-4 -translate-y-1/2 text-foreground dark:text-accent">
                    <CheckIcon className="size-4" aria-hidden />
                  </Combobox.ItemIndicator>
                </Combobox.Item>
              )}
            </Combobox.List>
            <Combobox.Empty className="empty:hidden min-h-0 px-4 py-8 text-center text-sm text-muted-foreground">
              {available.length === 0
                ? "Alle Tags ausgewählt"
                : "Kein Treffer für diese Suche"}
            </Combobox.Empty>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  )
}
