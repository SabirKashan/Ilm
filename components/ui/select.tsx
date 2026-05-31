"use client"

import * as React from "react"
import { Select as SelectPrimitive } from "@base-ui/react/select"

import { cn } from "@/lib/utils"
import { ChevronDownIcon, CheckIcon, ChevronUpIcon } from "lucide-react"

// ── Label registry ─────────────────────────────────────────────────────────
// Base UI SelectValue resolves labels from the `items` store that SelectItem
// populates by mounting. In practice this causes a flash of the raw value
// (UUID) on first render. We maintain a parallel value→label map in context
// and use it to drive a custom display span in SelectTrigger.
type LabelCtx = {
  register: (value: string, label: string) => void
  getLabel: (value: string) => string | undefined
  value: string | undefined
  setValue: (v: string | undefined) => void
}

const SelectLabelContext = React.createContext<LabelCtx | null>(null)

function Select({ children, value, defaultValue, ...props }: SelectPrimitive.Root.Props<string>) {
  const mapRef = React.useRef<Map<string, string>>(new Map())
  const [, tick] = React.useReducer(x => x + 1, 0)

  // For controlled selects (value prop provided), use it directly.
  // For uncontrolled, track the last selected value via data attribute trick.
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | undefined>(
    defaultValue ?? undefined
  )
  const currentValue = value ?? uncontrolledValue

  const ctx = React.useMemo<LabelCtx>(() => ({
    register: (v, l) => {
      if (mapRef.current.get(v) !== l) { mapRef.current.set(v, l); tick() }
    },
    getLabel: (v) => mapRef.current.get(v),
    value: currentValue,
    setValue: setUncontrolledValue,
  }), [currentValue]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SelectLabelContext.Provider value={ctx}>
      <SelectPrimitive.Root value={value} defaultValue={defaultValue} {...props}>
        {children}
      </SelectPrimitive.Root>
    </SelectLabelContext.Provider>
  )
}

function SelectGroup({ className, ...props }: SelectPrimitive.Group.Props) {
  return (
    <SelectPrimitive.Group
      data-slot="select-group"
      className={cn("scroll-my-1 p-1", className)}
      {...props}
    />
  )
}

// SelectValue is kept for API compatibility but the actual display is handled
// in SelectTrigger via the label context.
function SelectValue({ className, placeholder, ...props }: SelectPrimitive.Value.Props) {
  return (
    <SelectPrimitive.Value
      data-slot="select-value"
      className={cn("flex flex-1 text-left", className)}
      placeholder={placeholder}
      {...props}
    />
  )
}

function SelectTrigger({
  className,
  size = "default",
  children,
  ...props
}: SelectPrimitive.Trigger.Props & { size?: "sm" | "default" }) {
  const ctx = React.useContext(SelectLabelContext)

  // Find the SelectValue child and replace it with our label-aware version
  const renderedChildren = React.Children.map(children, (child) => {
    if (!React.isValidElement(child)) return child
    // Match our SelectValue wrapper (data-slot check happens at runtime)
    const type = child.type as any
    if (type === SelectValue || (typeof type === 'function' && type.name === 'SelectValue')) {
      const childProps = child.props as any
      const placeholder = childProps.placeholder
      const resolvedLabel = ctx?.value ? ctx.getLabel(ctx.value) : undefined
      const display = resolvedLabel ?? (ctx?.value ? ctx.value : undefined)
      return (
        <span
          data-slot="select-value"
          data-placeholder={!resolvedLabel && !ctx?.value ? "" : undefined}
          className={cn("flex flex-1 text-left line-clamp-1", childProps.className)}
        >
          {display ?? <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      )
    }
    return child
  })

  return (
    <SelectPrimitive.Trigger
      data-slot="select-trigger"
      data-size={size}
      className={cn(
        "flex w-fit items-center justify-between gap-1.5 rounded-lg border border-input bg-transparent py-2 pr-2 pl-2.5 text-sm whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-placeholder:text-muted-foreground data-[size=default]:h-8 data-[size=sm]:h-7 data-[size=sm]:rounded-[min(var(--radius-md),10px)] *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center *:data-[slot=select-value]:gap-1.5 dark:bg-input/30 dark:hover:bg-input/50 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {renderedChildren}
      <SelectPrimitive.Icon
        render={<ChevronDownIcon className="pointer-events-none size-4 text-muted-foreground" />}
      />
    </SelectPrimitive.Trigger>
  )
}

function SelectContent({
  className,
  children,
  side = "bottom",
  sideOffset = 4,
  align = "center",
  alignOffset = 0,
  alignItemWithTrigger = true,
  ...props
}: SelectPrimitive.Popup.Props &
  Pick<SelectPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset" | "alignItemWithTrigger">) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Positioner
        side={side} sideOffset={sideOffset} align={align}
        alignOffset={alignOffset} alignItemWithTrigger={alignItemWithTrigger}
        className="isolate z-50"
      >
        <SelectPrimitive.Popup
          data-slot="select-content"
          data-align-trigger={alignItemWithTrigger}
          className={cn("relative isolate z-50 max-h-(--available-height) w-(--anchor-width) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-lg bg-popover text-popover-foreground shadow-md ring-1 ring-foreground/10 duration-100 data-[align-trigger=true]:animate-none data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95", className)}
          {...props}
        >
          <SelectScrollUpButton />
          <SelectPrimitive.List>{children}</SelectPrimitive.List>
          <SelectScrollDownButton />
        </SelectPrimitive.Popup>
      </SelectPrimitive.Positioner>
    </SelectPrimitive.Portal>
  )
}

function SelectLabel({ className, ...props }: SelectPrimitive.GroupLabel.Props) {
  return (
    <SelectPrimitive.GroupLabel
      data-slot="select-label"
      className={cn("px-1.5 py-1 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function SelectItem({
  className,
  children,
  label,
  value,
  ...props
}: SelectPrimitive.Item.Props & { label?: string }) {
  const ctx = React.useContext(SelectLabelContext)
  const derivedLabel = label ?? (typeof children === "string" ? children : undefined)

  // Register value→label so SelectTrigger can display the name
  React.useEffect(() => {
    if (ctx && value !== undefined && derivedLabel !== undefined) {
      ctx.register(String(value), derivedLabel)
    }
  }, [value, derivedLabel]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <SelectPrimitive.Item
      data-slot="select-item"
      value={value}
      label={derivedLabel}
      className={cn(
        "relative flex w-full cursor-default items-center gap-1.5 rounded-md py-1 pr-8 pl-1.5 text-sm outline-hidden select-none focus:bg-accent focus:text-accent-foreground not-data-[variant=destructive]:focus:**:text-accent-foreground data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 *:[span]:last:flex *:[span]:last:items-center *:[span]:last:gap-2",
        className
      )}
      {...props}
    >
      <SelectPrimitive.ItemText className="flex flex-1 shrink-0 gap-2 whitespace-nowrap">
        {children}
      </SelectPrimitive.ItemText>
      <SelectPrimitive.ItemIndicator
        render={<span className="pointer-events-none absolute right-2 flex size-4 items-center justify-center" />}
      >
        <CheckIcon className="pointer-events-none" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  )
}

function SelectSeparator({ className, ...props }: SelectPrimitive.Separator.Props) {
  return (
    <SelectPrimitive.Separator
      data-slot="select-separator"
      className={cn("pointer-events-none -mx-1 my-1 h-px bg-border", className)}
      {...props}
    />
  )
}

function SelectScrollUpButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollUpArrow>) {
  return (
    <SelectPrimitive.ScrollUpArrow
      data-slot="select-scroll-up-button"
      className={cn("top-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      <ChevronUpIcon />
    </SelectPrimitive.ScrollUpArrow>
  )
}

function SelectScrollDownButton({ className, ...props }: React.ComponentProps<typeof SelectPrimitive.ScrollDownArrow>) {
  return (
    <SelectPrimitive.ScrollDownArrow
      data-slot="select-scroll-down-button"
      className={cn("bottom-0 z-10 flex w-full cursor-default items-center justify-center bg-popover py-1 [&_svg:not([class*='size-'])]:size-4", className)}
      {...props}
    >
      <ChevronDownIcon />
    </SelectPrimitive.ScrollDownArrow>
  )
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
}
