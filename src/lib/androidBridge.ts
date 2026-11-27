// Typed access to the native helpers injected by MainActivity (window.KivoAndroid).
// Only present inside the Kivo Android app, never in a browser or on desktop.

interface KivoAndroidNative {
  canInstallPackages(): boolean;
  openInstallSettings(): void;
  downloadAndInstall(url: string): boolean;
  openExternal(url: string): boolean;
}

export type ApkUpdateStatus = 'downloading' | 'verifying' | 'installing' | 'error';

export interface ApkUpdateEvent {
  status: ApkUpdateStatus;
  percent?: number;
  message?: string;
}

export const getAndroidBridge = (): KivoAndroidNative | null => {
  const bridge = (window as unknown as { KivoAndroid?: KivoAndroidNative }).KivoAndroid;
  return bridge && typeof bridge.downloadAndInstall === 'function' ? bridge : null;
};

/** Subscribes to progress pushed by the native updater. Returns an unsubscribe function. */
export const onApkUpdate = (handler: (e: ApkUpdateEvent) => void): (() => void) => {
  const listener = (ev: Event) => handler((ev as CustomEvent<ApkUpdateEvent>).detail);
  window.addEventListener('kivo:apk-update', listener);
  return () => window.removeEventListener('kivo:apk-update', listener);
};

/**
 * Opens tel:, sms:, WhatsApp or release links. Inside the Android app this goes through the
 * native bridge (a WebView cannot launch other apps by itself); elsewhere a normal link opens.
 */
export const openExternal = (url: string) => {
  const bridge = getAndroidBridge();
  if (bridge?.openExternal) {
    if (bridge.openExternal(url)) return;
  }
  window.open(url, '_blank', 'noopener');
};

/** Indonesian numbers typed as 08xx become 628xx for WhatsApp. */
export const toWhatsAppNumber = (phone: string): string => {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('0')) return '62' + digits.slice(1);
  if (digits.startsWith('62')) return digits;
  return digits;
};
