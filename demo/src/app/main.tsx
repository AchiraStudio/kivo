import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource-variable/manrope';
import '../styles/app.css';
import App from '../../../src/App';
import { ThemeProvider } from '../../../src/components/ThemeProvider';
import { ToastProvider } from '../../../src/components/ui/Toast';
import { installMockHost } from '../mock/host';
import { useSyncStore } from '../../../src/store/SyncStore';
import { cancelScene, playScene } from './autoplay';
import { SCENES } from './scenes';
import { forwardIdleWheel, installFrameGuards } from './frameGuards';

installFrameGuards();
forwardIdleWheel();

// ?device=desktop | phone | android   ?theme=dark | light   ?scene=<name>   ?autoplay=0
const params = new URLSearchParams(window.location.search);
const device = params.get('device') || 'desktop';
const theme = params.get('theme') === 'light' ? 'light' : 'dark';
const sceneName = params.get('scene') || '';
const autoplay = params.get('autoplay') !== '0';

const host = installMockHost();

try {
  localStorage.setItem('kivo-theme', theme);
  localStorage.setItem('kivo_openai_api_key', 'demo'); // Kivo AI is scripted in the demo
  localStorage.setItem('kivo_host_url', 'http://192.168.1.8:3699'); // shown in the UI; the mock host answers by path
  localStorage.removeItem('kivo-auth'); // always start from the "joined the host" path
  localStorage.removeItem('kivo_skip_auto_join');
  localStorage.removeItem('pos-storage');
  localStorage.setItem('kivo_sidebar_collapsed', 'false');
  sessionStorage.setItem('kivo_tour_done', '1');
} catch {
  /* storage unavailable: the demo still runs */
}
document.documentElement.classList.remove('light', 'dark');
document.documentElement.classList.add(theme);

// "android": run as the Android app (client mode) so the phone-only screens appear for real.
if (device === 'android') {
  Object.defineProperty(navigator, 'userAgent', {
    get: () => 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36',
  });
  const current = __APP_VERSION__.split('.').map(Number);
  const next = `${current[0]}.${current[1]}.${current[2] + 1}`;
  (window as any).__TAURI_INTERNALS__ = {
    metadata: {},
    transformCallback: () => 0,
    invoke: async (cmd: string) =>
      cmd === 'check_for_updates'
        ? {
            has_update: params.get('update') !== '0',
            current_version: __APP_VERSION__,
            latest_version: `v${next}`,
            release_title: `Kivo v${next}`,
            release_notes: '- Pembaruan langsung dari dalam aplikasi\n- Input pelanggan lebih cepat\n- Perbaikan dan peningkatan kecepatan',
            published_at: new Date().toISOString(),
            download_url: `https://github.com/AchiraStudio/kivo/releases/download/v${next}/Kivo_${next}_android.apk`,
            asset_name: `Kivo_${next}_android.apk`,
            asset_size: 31457280,
          }
        : null,
  };
  (window as any).KivoAndroid = {
    canInstallPackages: () => true,
    openInstallSettings: () => {},
    openExternal: () => true,
    downloadAndInstall: () => {
      let pct = 0;
      const timer = setInterval(() => {
        pct += 7 + Math.random() * 9;
        const done = pct >= 100;
        window.dispatchEvent(new CustomEvent('kivo:apk-update', { detail: done ? { status: 'installing', percent: 100 } : { status: 'downloading', percent: Math.round(pct) } }));
        if (done) clearInterval(timer);
      }, 220);
      return true;
    },
  };
  if (sceneName !== 'connect') {
    localStorage.setItem('kivo_mobile_mode', 'client');
  } else if (!sessionStorage.getItem('demo_connected')) {
    localStorage.removeItem('kivo_mobile_mode');
  }
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ThemeProvider defaultTheme={theme}>
      <ToastProvider>
        <App />
      </ToastProvider>
    </ThemeProvider>
  </React.StrictMode>,
);

// The real app shows "Online" once cloud sync is live; do the same for the showcase.
for (const delay of [1200, 3200, 6000]) {
  setTimeout(() => {
    useSyncStore.getState().setStatus('connected');
    useSyncStore.getState().setLastSyncTime(new Date());
  }, delay);
}

const run = (name: string) => {
  const scene = SCENES[name];
  if (scene) void playScene(scene);
};

if (sceneName && autoplay) setTimeout(() => run(sceneName), device === 'android' ? 1800 : 1400);

// Messages from the showcase site.
window.addEventListener('message', (e: MessageEvent) => {
  const m = e.data;
  if (!m || typeof m !== 'object' || !('kivo' in m)) return;
  switch (m.kivo) {
    case 'navigate':
      window.dispatchEvent(new CustomEvent('kivo:navigate', { detail: m.menu }));
      break;
    case 'theme':
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(m.theme === 'light' ? 'light' : 'dark');
      try { localStorage.setItem('kivo-theme', m.theme === 'light' ? 'light' : 'dark'); } catch { /* ignore */ }
      break;
    case 'offline':
      host.setOnline(!m.value);
      window.dispatchEvent(new Event('online')); // the real app re-checks its host link on this event
      break;
    case 'play':
      run(m.scene);
      break;
    case 'stop':
      cancelScene();
      break;
  }
});

window.parent?.postMessage({ kivo: 'ready', device }, '*');
