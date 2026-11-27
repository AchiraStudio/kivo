// src/lib/runtime.ts
// Multi-Device Runtime Detector & Host Gateway Resolver

export const isTauri = (): boolean => {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window;
};

export const isAndroid = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
};

export const isIOS = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
};

export const isMobilePlatform = (): boolean => {
  return isAndroid() || isIOS();
};

export const isDesktopTauri = (): boolean => {
  return isTauri() && !isMobilePlatform();
};

export const isMobileTauri = (): boolean => {
  return isTauri() && isMobilePlatform();
};

// --- Mobile app mode -------------------------------------------------------
// The Android app can either act as a terminal for the main cashier PC ("client",
// the same way a phone browser does) or run its own local database ("standalone").
export type MobileMode = 'client' | 'standalone';
const MOBILE_MODE_KEY = 'kivo_mobile_mode';

export const getMobileMode = (): MobileMode | null => {
  try {
    const v = localStorage.getItem(MOBILE_MODE_KEY);
    return v === 'client' || v === 'standalone' ? v : null;
  } catch {
    return null;
  }
};

export const setMobileMode = (mode: MobileMode | null) => {
  try {
    if (mode) localStorage.setItem(MOBILE_MODE_KEY, mode);
    else localStorage.removeItem(MOBILE_MODE_KEY);
  } catch {
    // Storage can be unavailable in restricted contexts
  }
};

/**
 * True when business data lives on another device: a plain browser, or the Android
 * app connected to a main cashier PC. Such clients talk to the host over /api/lan/rpc.
 */
export const isRemoteClient = (): boolean => {
  if (!isTauri()) return true;
  return isMobileTauri() && getMobileMode() === 'client';
};

// Remote clients normally join the host's active session automatically. After an explicit
// logout we stop doing that until the user signs in again, otherwise logout would be a no-op.
export const SKIP_AUTO_JOIN_KEY = 'kivo_skip_auto_join';
export const skipAutoJoin = (): boolean => {
  try {
    return localStorage.getItem(SKIP_AUTO_JOIN_KEY) === '1';
  } catch {
    return false;
  }
};
export const clearSkipAutoJoin = () => {
  try {
    localStorage.removeItem(SKIP_AUTO_JOIN_KEY);
  } catch {
    // Storage can be unavailable in restricted contexts
  }
};

export interface ParsedHostLink {
  hostUrl: string;
  session: string | null;
}

/**
 * Accepts what people actually type or scan: "192.168.1.8", "192.168.1.8:3699",
 * "http://192.168.1.8:3699" or the full Host QR link with "?session=...".
 */
export const parseHostLink = (raw: string): ParsedHostLink | null => {
  let text = (raw || '').trim();
  if (!text) return null;
  if (!/^https?:\/\//i.test(text)) text = `http://${text}`;
  try {
    const url = new URL(text);
    if (!url.hostname) return null;
    const port = url.port || '3699';
    return {
      hostUrl: `http://${url.hostname}:${port}`,
      session: url.searchParams.get('session'),
    };
  } catch {
    return null;
  }
};

export const getHostUrl = (): string => {
  // 1. Check custom user-configured host in localStorage
  const custom = localStorage.getItem('kivo_host_url') || localStorage.getItem('kivo_lan_parent_url');
  if (custom && custom.trim() !== '') {
    return custom.trim().replace(/\/+$/, '');
  }

  // 2. If running in a web browser (e.g. mobile Safari / Chrome)
  if (typeof window !== 'undefined') {
    // If running on Vite dev server (port 1420, 5173, etc.), route API calls to the Rust Axum LAN server on port 3699
    if (window.location.port === '1420' || window.location.port === '5173' || window.location.port === '5174') {
      return `http://${window.location.hostname}:3699`;
    }
    return window.location.origin;
  }

  return 'http://localhost:3699';
};

export const setHostUrl = (url: string | null) => {
  if (url && url.trim() !== '') {
    const clean = url.trim().replace(/\/+$/, '');
    localStorage.setItem('kivo_host_url', clean);
    localStorage.setItem('kivo_lan_parent_url', clean);
  } else {
    localStorage.removeItem('kivo_host_url');
    localStorage.removeItem('kivo_lan_parent_url');
  }
};

