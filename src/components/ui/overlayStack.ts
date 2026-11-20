// Shared Escape stack & body scroll lock for Modal and Drawer overlays.
let activeOverlayCount = 0;
const overlayStack: string[] = [];

export function pushOverlay(id: string) {
  activeOverlayCount++;
  if (activeOverlayCount === 1) {
    document.body.style.overflow = 'hidden';
  }
  overlayStack.push(id);
}

export function popOverlay(id: string) {
  const idx = overlayStack.lastIndexOf(id);
  if (idx !== -1) overlayStack.splice(idx, 1);
  activeOverlayCount = Math.max(0, activeOverlayCount - 1);
  if (activeOverlayCount === 0) {
    document.body.style.overflow = '';
  }
}

export function isTopOverlay(id: string): boolean {
  return overlayStack[overlayStack.length - 1] === id;
}
