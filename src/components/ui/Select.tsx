import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: React.ReactNode;
  disabled?: boolean;
}

export interface SelectProps {
  value?: string;
  onChange?: (value: string) => void;
  /** Explicit options list, or pass <option> elements as children */
  options?: SelectOption[];
  children?: React.ReactNode;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
  /** Panel alignment when wider than trigger */
  align?: 'left' | 'right';
  size?: 'sm' | 'md';
  ariaLabel?: string;
  required?: boolean;
  name?: string;
}

function optionsFromChildren(children: React.ReactNode): SelectOption[] {
  const out: SelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const props = child.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
    if (child.type === 'option') {
      out.push({ value: props.value ?? '', label: props.children, disabled: props.disabled });
    } else if (child.type === 'optgroup') {
      React.Children.forEach(props.children, (opt) => {
        if (React.isValidElement(opt) && opt.type === 'option') {
          const o = opt.props as { value?: string; children?: React.ReactNode; disabled?: boolean };
          out.push({ value: o.value ?? '', label: o.children, disabled: o.disabled });
        }
      });
    }
  });
  return out;
}

/**
 * Unified portal-rendered dropdown for the entire app.
 * Avoids overflow clipping inside modals/drawers/tables, flips upward near the
 * bottom edge of the viewport, and supports full keyboard navigation.
 */
export default function Select({
  value,
  onChange,
  options,
  children,
  disabled = false,
  placeholder = 'Pilih...',
  className = '',
  align = 'left',
  size = 'md',
  ariaLabel,
}: SelectProps) {
  const opts = options ?? optionsFromChildren(children);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; minWidth: number; maxHeight: number } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const listId = useId();

  const selected = opts.find((o) => o.value === value);
  const selectedIndex = opts.findIndex((o) => o.value === value);

  // Strip stray border/padding/bg classes if a legacy caller passed input styles to Select
  const layoutClasses = className
    .split(/\s+/)
    .filter((token) =>
      token &&
      !token.startsWith('bg-') &&
      !token.startsWith('border') &&
      !token.startsWith('px-') &&
      !token.startsWith('py-') &&
      !token.startsWith('p-') &&
      !token.startsWith('rounded') &&
      !token.startsWith('outline') &&
      !token.startsWith('ring') &&
      !token.startsWith('focus:')
    )
    .join(' ');

  const computePosition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const gap = 4;
    const viewportH = window.innerHeight;
    const viewportW = window.innerWidth;
    const spaceBelow = viewportH - rect.bottom - gap - 8;
    const spaceAbove = rect.top - gap - 8;
    const estimatedHeight = Math.min(240, opts.length * 34 + 10);
    const openUpward = spaceBelow < Math.min(180, estimatedHeight) && spaceAbove > spaceBelow;
    const maxHeight = Math.max(120, Math.min(260, openUpward ? spaceAbove : spaceBelow));
    const panelWidth = Math.max(rect.width, 160);
    const rawLeft = align === 'right' ? rect.right - panelWidth : rect.left;
    const left = Math.max(8, Math.min(rawLeft, viewportW - panelWidth - 8));
    const top = openUpward
      ? Math.max(8, rect.top - gap - Math.min(estimatedHeight, maxHeight))
      : rect.bottom + gap;

    setPanelPos({ top, left, minWidth: rect.width, maxHeight });
  }, [align, opts.length]);

  useLayoutEffect(() => {
    if (!open) {
      setPanelPos(null);
      return;
    }
    computePosition();
    const onReflow = () => computePosition();
    window.addEventListener('resize', onReflow);
    window.addEventListener('scroll', onReflow, true);
    return () => {
      window.removeEventListener('resize', onReflow);
      window.removeEventListener('scroll', onReflow, true);
    };
  }, [open, computePosition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!rootRef.current?.contains(target) && !listRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (open) setActiveIdx(selectedIndex >= 0 ? selectedIndex : 0);
  }, [open, selectedIndex]);

  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open]);

  const openPanel = () => {
    if (disabled || opts.length === 0) return;
    setOpen(true);
  };

  const commit = (val: string) => {
    setOpen(false);
    triggerRef.current?.focus();
    if (val !== value) onChange?.(val);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
        e.preventDefault();
        openPanel();
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIdx((i) => Math.min(opts.length - 1, i + 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIdx((i) => Math.max(0, i - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (activeIdx >= 0 && !opts[activeIdx].disabled) commit(opts[activeIdx].value);
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
        triggerRef.current?.focus();
        break;
      case 'Tab':
        setOpen(false);
        break;
    }
  };

  const triggerBase = size === 'sm' ? 'h-8 px-2.5 text-xs' : 'h-9 px-3 text-sm';

  return (
    <div
      ref={rootRef}
      className={`relative ${layoutClasses}`}
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listId}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openPanel())}
        className={`${triggerBase} w-full flex items-center justify-between gap-2 rounded-lg border border-line bg-input text-heading font-medium text-left cursor-pointer transition-colors hover:border-line-strong focus-visible:outline-none focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/25 disabled:opacity-50 disabled:cursor-not-allowed ${
          open ? 'border-primary ring-2 ring-primary/20' : ''
        }`}
      >
        <span className="truncate">
          {selected ? selected.label : <span className="text-dim font-normal">{placeholder}</span>}
        </span>
        <ChevronDown
          size={14}
          className={`shrink-0 text-dim transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        panelPos &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            role="listbox"
            style={{
              position: 'fixed',
              top: panelPos.top,
              left: panelPos.left,
              minWidth: panelPos.minWidth,
              maxHeight: panelPos.maxHeight,
            }}
            className="z-[1200] w-max max-w-80 overflow-y-auto custom-scrollbar rounded-lg border border-line bg-elevated shadow-lg shadow-black/15 dark:shadow-black/45 p-1 animate-pop-in"
          >
            {opts.map((opt, i) => {
              const isSelected = opt.value === value;
              const isActive = i === activeIdx;
              return (
                <button
                  key={`${opt.value}-${i}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={opt.disabled}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => commit(opt.value)}
                  onMouseEnter={() => setActiveIdx(i)}
                  className={`w-full flex items-center justify-between gap-2.5 px-2.5 py-1.5 rounded-md text-xs sm:text-sm text-left transition-colors ${
                    opt.disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
                  } ${
                    isSelected
                      ? 'bg-primary-soft text-primary font-semibold'
                      : isActive
                      ? 'bg-muted text-heading'
                      : 'text-body'
                  }`}
                >
                  <span className="truncate">{opt.label}</span>
                  {isSelected && <Check size={14} className="shrink-0 text-primary" />}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </div>
  );
}
