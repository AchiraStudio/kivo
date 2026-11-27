import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { isTopOverlay, popOverlay, pushOverlay } from './overlayStack';
import { useMobileBack } from '../../hooks/useMobileBack';

interface SheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

/**
 * Bottom sheet for phones: slides up from the thumb zone, closes with the system Back
 * gesture, a tap outside or Escape. Use instead of a centred modal for menus and pickers.
 */
export default function Sheet({ isOpen, onClose, title, children, footer }: SheetProps) {
  const titleId = useId();
  useMobileBack(isOpen, onClose);

  useEffect(() => {
    if (!isOpen) return;
    pushOverlay(titleId);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isTopOverlay(titleId)) {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      popOverlay(titleId);
    };
  }, [isOpen, onClose, titleId]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div className="absolute inset-0 bg-black/50 animate-fade-in" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 w-full max-h-[88dvh] flex flex-col bg-elevated text-heading rounded-t-3xl border-t border-line shadow-2xl shadow-black/30 animate-slide-in-up">
        <div className="pt-2.5 pb-1 flex justify-center shrink-0" aria-hidden="true">
          <span className="w-10 h-1 rounded-full bg-line-strong/50" />
        </div>
        {title && (
          <h2 id={titleId} className="px-5 pt-1 pb-3 text-base font-extrabold text-heading shrink-0">
            {title}
          </h2>
        )}
        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 pb-4">{children}</div>
        {footer && (
          <div className="px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] border-t border-line shrink-0">{footer}</div>
        )}
        {!footer && <div className="shrink-0 pb-[env(safe-area-inset-bottom)]" />}
      </div>
    </div>,
    document.body,
  );
}
