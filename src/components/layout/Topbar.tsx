import { useState, useEffect } from 'react';
import { Sun, Moon, Cloud, CloudOff, RefreshCw, ZoomIn, ZoomOut, Radio, QrCode, Menu, ArrowUpCircle, MessageSquare } from 'lucide-react';
import { useTheme } from '../ThemeProvider';
import { useSyncStore } from '../../store/SyncStore';
import { useZoomStore } from '../../store/ZoomStore';
import { useUpdaterStore } from '../../store/UpdaterStore';
import { getLanPeers, LanPeer } from '../../lib/api';
import { listen } from '../../lib/events';

interface TopbarProps {
  activeMenu: string;
  setActiveMenu?: (menu: string) => void;
  onOpenAIChat?: () => void;
  onOpenHostQr?: () => void;
  onOpenMenuDrawer?: () => void;
}

const PAGE_TITLES: Record<string, string> = {
  dashboard: 'Ringkasan',
  pos: 'Kasir',
  inventory: 'Inventaris',
  purchasing: 'Pembelian',
  customers: 'Pelanggan',
  reports: 'Laporan',
  settings: 'Pengaturan',
};

export default function Topbar({ activeMenu, onOpenAIChat, onOpenHostQr, onOpenMenuDrawer }: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { status, lastSyncTime } = useSyncStore();
  const { zoom, zoomIn, zoomOut, reset } = useZoomStore();
  const { updateInfo, openModal } = useUpdaterStore();
  const [lanPeerCount, setLanPeerCount] = useState(0);

  useEffect(() => {
    getLanPeers().then(p => setLanPeerCount(p.length)).catch(() => {});
    let unlisten: (() => void) | undefined;
    listen<LanPeer[]>('kivo:lan_peers_updated', e => {
      setLanPeerCount(e.payload.length);
    }).then(u => {
      unlisten = u;
    });

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  const title = PAGE_TITLES[activeMenu] ?? activeMenu.replace(/-/g, ' ');

  return (
    <header className="h-12 sm:h-13 bg-card border-b border-line flex items-center px-3 sm:px-5 justify-between sticky top-0 z-10 shrink-0 select-none">
      <div className="min-w-0 mr-2">
        <h2 className="text-sm sm:text-[15px] font-bold text-heading tracking-tight truncate">
          {title}
        </h2>
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {/* LAN status */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium text-dim px-2 py-1 rounded-md border border-line bg-muted/50 tnum"
          title={`LAN: ${lanPeerCount} perangkat terdeteksi`}
        >
          <Radio size={12} strokeWidth={1.75} className={lanPeerCount > 1 ? 'text-success' : 'text-dim'} />
          <span>LAN {lanPeerCount}</span>
        </span>

        {/* Cloud sync status */}
        <span
          className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border ${
            status === 'connected'
              ? 'text-success bg-success-soft border-success/20'
              : status === 'connecting'
              ? 'text-warning bg-warning-soft border-warning/20'
              : 'text-dim bg-muted/50 border-line'
          }`}
          title={
            status === 'connected'
              ? lastSyncTime
                ? `Online (${lastSyncTime.toLocaleTimeString('id-ID')})`
                : 'Online'
              : status === 'connecting'
              ? 'Menyinkronkan...'
              : 'Mode lokal'
          }
        >
          {status === 'connected' ? (
            <>
              <Cloud size={12} strokeWidth={1.75} />
              <span>Online</span>
            </>
          ) : status === 'connecting' ? (
            <>
              <RefreshCw size={12} strokeWidth={1.75} className="animate-spin" />
              <span>Sync</span>
            </>
          ) : (
            <>
              <CloudOff size={12} strokeWidth={1.75} />
              <span>Lokal</span>
            </>
          )}
        </span>

        <div className="h-4 w-px bg-line mx-0.5 hidden lg:block" />

        {/* Zoom Controls (Desktop >= 1024px) */}
        <div className="hidden lg:flex items-center bg-muted/60 border border-line rounded-lg p-0.5">
          <button
            type="button"
            onClick={zoomOut}
            aria-label="Perkecil tampilan"
            className="text-dim hover:text-heading transition-colors p-1 rounded-md hover:bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Perkecil (Ctrl -)"
          >
            <ZoomOut size={13} strokeWidth={1.75} />
          </button>
          <button
            type="button"
            onClick={reset}
            aria-label="Reset zoom"
            className="text-[11px] font-semibold text-dim hover:text-heading px-1.5 py-0.5 rounded-md transition-colors hover:bg-card font-mono tnum cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Reset 100% (Ctrl 0)"
          >
            {zoom}%
          </button>
          <button
            type="button"
            onClick={zoomIn}
            aria-label="Perbesar tampilan"
            className="text-dim hover:text-heading transition-colors p-1 rounded-md hover:bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Perbesar (Ctrl +)"
          >
            <ZoomIn size={13} strokeWidth={1.75} />
          </button>
        </div>

        {/* Host QR */}
        {onOpenHostQr && (
          <button
            type="button"
            onClick={onOpenHostQr}
            aria-label="QR Akses LAN"
            className="w-8 h-8 flex items-center justify-center text-dim hover:text-heading rounded-lg hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="QR Akses LAN"
          >
            <QrCode size={16} strokeWidth={1.75} />
          </button>
        )}

        {/* Available Update */}
        {updateInfo?.has_update && (() => {
          const verLabel = updateInfo.latest_version.startsWith('v')
            ? updateInfo.latest_version
            : `v${updateInfo.latest_version}`;
          return (
            <button
              type="button"
              onClick={openModal}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-primary-soft hover:bg-primary/15 text-primary border border-primary/25 rounded-lg text-xs font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title={`Update ${verLabel}`}
            >
              <ArrowUpCircle size={14} strokeWidth={1.75} />
              <span className="hidden sm:inline">{verLabel}</span>
            </button>
          );
        })()}

        {/* Theme Toggle */}
        <button
          type="button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label="Ganti tema"
          className="w-8 h-8 flex items-center justify-center text-dim hover:text-heading rounded-lg hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
        >
          {theme === 'dark' ? <Sun size={16} strokeWidth={1.75} /> : <Moon size={16} strokeWidth={1.75} />}
        </button>

        {/* AI Chat (secondary outline so page primary CTA keeps sole accent focus) */}
        {onOpenAIChat && (
          <button
            type="button"
            onClick={onOpenAIChat}
            aria-label="Buka Kivo AI"
            className="inline-flex items-center gap-1.5 h-8 px-2.5 bg-card hover:bg-muted text-heading border border-line hover:border-line-strong rounded-lg font-semibold text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Kivo AI"
          >
            <MessageSquare size={14} strokeWidth={1.75} className="text-primary" aria-hidden="true" />
            <span className="hidden sm:inline">Kivo AI</span>
          </button>
        )}

        {/* Mobile Menu Trigger (< 768px) */}
        {onOpenMenuDrawer && (
          <button
            type="button"
            onClick={onOpenMenuDrawer}
            aria-label="Buka menu"
            className="md:hidden w-9 h-9 flex items-center justify-center text-dim hover:text-heading rounded-lg hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title="Menu"
          >
            <Menu size={18} strokeWidth={1.75} />
          </button>
        )}
      </div>
    </header>
  );
}
