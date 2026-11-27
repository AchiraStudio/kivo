import { useEffect, useRef } from 'react';

type BackHandler = () => void;

const backStack: { id: symbol; onBack: BackHandler }[] = [];
let listenerAttached = false;
let ignoringNextPop = false;
// Number of synthetic history entries we pushed and have not yet consumed.
let syntheticDepth = 0;
let flushScheduled = false;

function handlePopState() {
  if (ignoringNextPop) {
    ignoringNextPop = false;
    return;
  }
  const top = backStack.pop();
  if (top) {
    syntheticDepth = Math.max(0, syntheticDepth - 1);
    top.onBack();
  }
}

function ensureListener() {
  if (listenerAttached || typeof window === 'undefined') return;
  window.addEventListener('popstate', handlePopState);
  listenerAttached = true;
}

/**
 * Overlays that were closed from the UI (button, backdrop) leave a synthetic history entry
 * behind. Drop the surplus once the current render has settled: when one sheet replaces
 * another in the same tick, the newcomer's entry must survive, so we only go back by the
 * difference between entries pushed and overlays still open.
 */
function scheduleFlush() {
  if (flushScheduled) return;
  flushScheduled = true;
  setTimeout(() => {
    flushScheduled = false;
    const surplus = syntheticDepth - backStack.length;
    if (surplus <= 0) return;
    try {
      ignoringNextPop = true;
      syntheticDepth -= surplus;
      window.history.go(-surplus);
    } catch {
      ignoringNextPop = false;
    }
  }, 0);
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
      syntheticDepth++;
    } catch {
      // Ignore restricted history contexts
    }

    return () => {
      const idx = backStack.findIndex((item) => item.id === id);
      if (idx !== -1) {
        backStack.splice(idx, 1);
        scheduleFlush();
      }
    };
  }, [isOpen]);
}
