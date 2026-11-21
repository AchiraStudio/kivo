import { useEffect, useRef } from 'react';

type BackHandler = () => void;

const backStack: { id: symbol; onBack: BackHandler }[] = [];
let listenerAttached = false;
let ignoringNextPop = false;

function handlePopState() {
  if (ignoringNextPop) {
    ignoringNextPop = false;
    return;
  }
  const top = backStack.pop();
  if (top) {
    top.onBack();
  }
}

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listenerAttached = true;
}

/**
 * Registers an open overlay (modal, drawer, sheet) on a LIFO history stack so
 * Android's system Back gesture/button closes the topmost overlay instead of
 * exiting the application.
 */
export function useMobileBack(isOpen: boolean, onClose?: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!isOpen || !onCloseRef.current || typeof window === 'undefined') return;

    ensureListener();
    const id = Symbol('mobile-back');
    const entry = {
      id,
      onBack: () => {
        onCloseRef.current?.();
      },
    };

    backStack.push(entry);
    try {
      window.history.pushState({ kivoOverlay: true }, '');
    } catch {
      // Ignore restricted history contexts
    }

    return () => {
      const idx = backStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        backStack.splice(idx, 1);
        // Clean up the synthetic history entry when closed via UI button/backdrop
        try {
          if (window.history.state && (window.history.state as { kivoOverlay?: boolean }).kivoOverlay) {
            ignoringNextPop = true;
            window.history.back();
          }
        } catch {
          ignoringNextPop = false;
        }
      }
    };
  }, [isOpen]);
}
