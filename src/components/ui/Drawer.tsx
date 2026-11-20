import React, { useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { X, LucideIcon } from 'lucide-react';
import { isTopOverlay, popOverlay, pushOverlay } from './overlayStack';

export type DrawerSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

export interface DrawerProps {
  isOpen?: boolean;
  onClose?: () => void;
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: LucideIcon | React.ReactNode;
  iconBg?: string;
  badge?: React.ReactNode;
  headerRight?: React.ReactNode;
  footer?: React.ReactNode;
  size?: DrawerSize;
  closeOnBackdropClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  className?: string;
  backdropClassName?: string;
  bodyClassName?: string;
  headerClassName?: string;
  footerClassName?: string;
  scrollable?: boolean;
  noPadding?: boolean;
  children?: React.ReactNode;
}

const DRAWER_SIZES: Record<DrawerSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-full',
};

export default function Drawer({
  isOpen = true,
  onClose,
  title,
  subtitle,
  icon: IconOrElement,
  iconBg = 'bg-muted text-heading',
  badge,
  headerRight,
  footer,
  size = 'md',
  closeOnBackdropClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  className = '',
  backdropClassName = '',
  bodyClassName = '',
  headerClassName = '',
  footerClassName = '',
  scrollable = true,
  noPadding = false,
  children,
}: DrawerProps) {
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    pushOverlay(titleId);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEsc && onClose && isTopOverlay(titleId)) {
        e.stopPropagation();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      popOverlay(titleId);
    };
  }, [isOpen, closeOnEsc, onClose, titleId]);

  if (!isOpen) return null;

  const renderIcon = () => {
    if (!IconOrElement) return null;
    if (React.isValidElement(IconOrElement)) {
      return IconOrElement;
    }
    const IconComponent = IconOrElement as React.ComponentType<{ size?: number; className?: string }>;
    return (
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg}`}>
        <IconComponent size={16} />
      </div>
    );
  };

  const hasHeader = Boolean(title || subtitle || IconOrElement || headerRight || showCloseButton);

  const drawerContent = (
    <div
      className={`fixed inset-0 z-[1000] flex justify-end overflow-hidden ${backdropClassName}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
    >
      <div
        className="fixed inset-0 bg-black/45 animate-fade-in"
        onClick={() => {
          if (closeOnBackdropClick && onClose) {
            onClose();
          }
        }}
        aria-hidden="true"
      />

      <div
        className={`relative z-10 w-full ${DRAWER_SIZES[size]} bg-elevated text-heading h-full shadow-lg shadow-black/15 dark:shadow-black/45 flex flex-col border-l border-line animate-slide-in-right ${className}`}
        onClick={(e) => e.stopPropagation()}
      >
        {hasHeader && (
          <div
            className={`px-4 sm:px-5 py-3.5 border-b border-line flex items-center justify-between gap-3 shrink-0 ${headerClassName}`}
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              {renderIcon()}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  {title && (
                    <h2 id={titleId} className="text-sm sm:text-[15px] font-bold text-heading truncate">
                      {title}
                    </h2>
                  )}
                  {badge}
                </div>
                {subtitle && (
                  <p className="text-xs text-dim mt-0.5 truncate">{subtitle}</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {headerRight}
              {showCloseButton && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Tutup"
                  className="w-8 h-8 flex items-center justify-center text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )}

        <div
          className={`flex-1 ${
            scrollable ? 'overflow-y-auto custom-scrollbar' : 'overflow-visible'
          } ${noPadding ? '' : 'p-4 sm:p-5'} ${bodyClassName}`}
        >
          {children}
        </div>

        {footer && (
          <div
            className={`px-4 sm:px-5 py-3 border-t border-line bg-muted/30 flex items-center justify-end gap-2 shrink-0 ${footerClassName}`}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
}

Drawer.Header = function DrawerHeader({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-4 sm:px-5 py-3.5 border-b border-line flex items-center justify-between gap-3 shrink-0 ${className}`}
    >
      {children}
    </div>
  );
};

Drawer.Body = function DrawerBody({
  className = '',
  noPadding = false,
  scrollable = true,
  children,
}: {
  className?: string;
  noPadding?: boolean;
  scrollable?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`flex-1 ${
        scrollable ? 'overflow-y-auto custom-scrollbar' : 'overflow-visible'
      } ${noPadding ? '' : 'p-4 sm:p-5'} ${className}`}
    >
      {children}
    </div>
  );
};

Drawer.Footer = function DrawerFooter({
  className = '',
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`px-4 sm:px-5 py-3 border-t border-line bg-muted/30 flex items-center justify-end gap-2 shrink-0 ${className}`}
    >
      {children}
    </div>
  );
};
