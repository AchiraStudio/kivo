// The app runs inside an iframe on the showcase page. Browsers scroll *every* ancestor frame to
// reveal a focused element or a scrollIntoView() target, which would yank the visitor's page
// around (for example when the cashier search box auto-focuses). Keep all scrolling inside the app.

export function revealWithin(el: HTMLElement, behavior: ScrollBehavior = 'smooth') {
  for (let p = el.parentElement; p && p !== document.documentElement; p = p.parentElement) {
    if (p.scrollHeight <= p.clientHeight + 4 || !/(auto|scroll)/.test(getComputedStyle(p).overflowY)) continue;
    const pr = p.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    if (er.top < pr.top + 24 || er.bottom > pr.bottom - 24) {
      p.scrollTo({ top: p.scrollTop + (er.top - pr.top) - pr.height / 2 + er.height / 2, behavior });
    }
  }
}

export function installFrameGuards() {
  if (window.parent === window) return; // opened on its own: leave the browser alone

  const nativeFocus = HTMLElement.prototype.focus;
  HTMLElement.prototype.focus = function (options?: FocusOptions) {
    return nativeFocus.call(this, { ...options, preventScroll: true });
  };

  Element.prototype.scrollIntoView = function (arg?: boolean | ScrollIntoViewOptions) {
    const behavior = typeof arg === 'object' && arg?.behavior === 'smooth' ? 'smooth' : 'auto';
    revealWithin(this as HTMLElement, behavior);
  };
}

/**
 * The app locks its own document (no page scroll), so a wheel turn over the frame would be
 * swallowed whenever no panel inside can scroll further. Hand those turns to the showcase page.
 */
export function forwardIdleWheel() {
  if (window.parent === window) return;
  const canScroll = (start: EventTarget | null, dy: number) => {
    for (let el = start as HTMLElement | null; el && el !== document.documentElement; el = el.parentElement) {
      if (!/(auto|scroll)/.test(getComputedStyle(el).overflowY)) continue;
      if (dy > 0 ? el.scrollTop + el.clientHeight < el.scrollHeight - 1 : el.scrollTop > 0) return true;
    }
    return false;
  };
  window.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey || canScroll(e.target, e.deltaY)) return;
      window.parent.postMessage({ kivo: 'wheel', dy: e.deltaMode === 1 ? e.deltaY * 32 : e.deltaY }, '*');
    },
    { passive: true },
  );
}
