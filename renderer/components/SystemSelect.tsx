import type React from 'react'
import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface SystemSelectOption {
  value: string
  label: React.ReactNode
  disabled?: boolean
}

interface Props {
  id?: string
  ariaLabel: string
  value: string
  options: SystemSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  className?: string
  triggerClassName?: string
  triggerStyle?: React.CSSProperties
  stopPropagation?: boolean
}

const POPOVER_MAX_HEIGHT = 220

export default function SystemSelect({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  disabled = false,
  className,
  triggerClassName,
  triggerStyle,
  stopPropagation = false,
}: Props) {
  const generatedId = useId()
  const buttonId = id ?? `system-select-${generatedId}`
  const listboxId = `${buttonId}-listbox`
  const rootRef = useRef<HTMLDivElement | null>(null)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const [open, setOpen] = useState(false)
  const [activeValue, setActiveValue] = useState(value)
  const [popoverStyle, setPopoverStyle] = useState<React.CSSProperties>({})

  const selected = options.find((option) => option.value === value) ?? options[0]
  const activeIndex = Math.max(
    0,
    options.findIndex((option) => option.value === activeValue),
  )

  const placePopover = useCallback(() => {
    const button = buttonRef.current
    if (!button) return
    const rect = button.getBoundingClientRect()
    const openUp =
      window.innerHeight - rect.bottom < POPOVER_MAX_HEIGHT && rect.top > POPOVER_MAX_HEIGHT
    setPopoverStyle({
      top: openUp ? rect.top - POPOVER_MAX_HEIGHT - 4 : rect.bottom + 4,
      left: rect.left,
      minWidth: rect.width,
      maxWidth: Math.max(rect.width, 360),
    })
  }, [])

  useEffect(() => {
    if (!open) return
    setActiveValue(value)
    placePopover()

    const handlePointerDown = (event: MouseEvent) => {
      const target = event.target as Node
      if (rootRef.current?.contains(target) || popoverRef.current?.contains(target)) return
      setOpen(false)
    }
    const handleReposition = () => placePopover()

    document.addEventListener('mousedown', handlePointerDown)
    window.addEventListener('resize', handleReposition)
    window.addEventListener('scroll', handleReposition, true)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      window.removeEventListener('resize', handleReposition)
      window.removeEventListener('scroll', handleReposition, true)
    }
  }, [open, value, placePopover])

  const commit = (nextValue: string) => {
    const option = options.find((item) => item.value === nextValue)
    if (!option || option.disabled) return
    onChange(nextValue)
    setOpen(false)
    buttonRef.current?.focus()
  }

  const move = (delta: number) => {
    if (options.length === 0) return
    let nextIndex = activeIndex
    for (let i = 0; i < options.length; i += 1) {
      nextIndex = (nextIndex + delta + options.length) % options.length
      if (!options[nextIndex].disabled) break
    }
    setActiveValue(options[nextIndex].value)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) setOpen(true)
      else move(1)
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (!open) setOpen(true)
      else move(-1)
      return
    }
    if (event.key === 'Home') {
      event.preventDefault()
      setActiveValue(options.find((option) => !option.disabled)?.value ?? value)
      return
    }
    if (event.key === 'End') {
      event.preventDefault()
      setActiveValue([...options].reverse().find((option) => !option.disabled)?.value ?? value)
      return
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) setOpen(true)
      else commit(activeValue)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
    }
  }

  return (
    <div ref={rootRef} className={`system-select ${className ?? ''}`}>
      <button
        id={buttonId}
        ref={buttonRef}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-controls={listboxId}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${listboxId}-${activeValue}` : undefined}
        className={`system-select-trigger ${triggerClassName ?? ''}`}
        style={triggerStyle}
        disabled={disabled}
        onClick={(event) => {
          if (stopPropagation) event.stopPropagation()
          setOpen((current) => !current)
        }}
        onMouseDown={(event) => {
          if (stopPropagation) event.stopPropagation()
        }}
        onKeyDown={handleKeyDown}
      >
        <span className="system-select-value">{selected?.label ?? 'sin opciones'}</span>
        <span className="system-select-caret" aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            ref={popoverRef}
            id={listboxId}
            role="listbox"
            aria-label={ariaLabel}
            className="system-select-popover"
            style={popoverStyle}
          >
            {options.map((option) => {
              const selectedOption = option.value === value
              const activeOption = option.value === activeValue
              return (
                <button
                  key={option.value}
                  id={`${listboxId}-${option.value}`}
                  type="button"
                  role="option"
                  aria-selected={selectedOption}
                  disabled={option.disabled}
                  className="system-select-option"
                  data-active={activeOption || undefined}
                  data-selected={selectedOption || undefined}
                  onMouseEnter={() => setActiveValue(option.value)}
                  onClick={() => commit(option.value)}
                >
                  {option.label}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </div>
  )
}
