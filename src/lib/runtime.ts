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

