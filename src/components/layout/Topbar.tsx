import { useState, useEffect } from 'react';
import {
  Sun,
  Moon,
  Cloud,
  CloudOff,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Radio,
  QrCode,
  ArrowUpCircle,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Minus,
  Square,
  Copy,
  X,
} from 'lucide-react';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { useTheme } from '../ThemeProvider';
import { useSyncStore } from '../../store/SyncStore';
import { useZoomStore } from '../../store/ZoomStore';
import { useUpdaterStore } from '../../store/UpdaterStore';
import { getLanPeers, getSettings, LanPeer } from '../../lib/api';
import { listen } from '../../lib/events';
import { isTauri } from '../../lib/runtime';
import KivoLogo from '../common/KivoLogo';

interface TopbarProps {
  activeMenu: string;
  setActiveMenu?: (menu: string) => void;
  onOpenAIChat?: () => void;
  onOpenHostQr?: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
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

export default function Topbar({
  activeMenu,
  onOpenAIChat,
  onOpenHostQr,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: TopbarProps) {
  const { theme, setTheme } = useTheme();
  const { status, lastSyncTime } = useSyncStore();
  const { zoom, zoomIn, zoomOut, reset } = useZoomStore();
  const { updateInfo, openModal } = useUpdaterStore();
  const [lanPeerCount, setLanPeerCount] = useState(0);
  const [companyName, setCompanyName] = useState('Kivo');
  const [branchName, setBranchName] = useState('');
  const [isMaximized, setIsMaximized] = useState(false);

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const co = settings.find((s) => s.key === 'company_name');
        const br = settings.find((s) => s.key === 'branch_name');
        if (co?.value) setCompanyName(co.value);
        if (br?.value) setBranchName(br.value);
      })
      .catch(() => {});

    getLanPeers().then((p) => setLanPeerCount(p.length)).catch(() => {});
    let unlistenLan: (() => void) | undefined;
    listen<LanPeer[]>('kivo:lan_peers_updated', (e) => {
      setLanPeerCount(e.payload.length);
    }).then((u) => {
      unlistenLan = u;
    });

    let unlistenResize: (() => void) | undefined;
    if (isTauri()) {
      try {
        const win = getCurrentWindow();
        win.isMaximized().then(setIsMaximized).catch(() => {});
        win
          .onResized(async () => {
            const max = await win.isMaximized();
            setIsMaximized(max);
          })
          .then((fn) => {
            unlistenResize = fn;
          })
          .catch(() => {});
      } catch {}
    }

    return () => {
      if (unlistenLan) unlistenLan();
      if (unlistenResize) unlistenResize();
    };
  }, []);

  const title = PAGE_TITLES[activeMenu] ?? activeMenu.replace(/-/g, ' ');

  const minimize = () => {
    if (isTauri()) getCurrentWindow().minimize();
  };
  const toggleMax = () => {
    if (isTauri()) (isMaximized ? getCurrentWindow().unmaximize() : getCurrentWindow().maximize());
  };
  const close = () => {
    if (isTauri()) getCurrentWindow().close();
  };

  return (
    <header
      data-tauri-drag-region
      className="hidden md:flex h-11 bg-sidebar border-b border-sidebar-line items-center justify-between shrink-0 select-none z-30"
    >
      {/* Left: Brand + Sidebar Toggle + Active Page Title */}
      <div data-tauri-drag-region className="flex items-center h-full min-w-0 pl-3 gap-2">
        <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
          <KivoLogo size={20} />
          <span className="text-xs font-bold text-heading truncate max-w-[140px]">
            {companyName}
          </span>
          {branchName && (
            <span className="hidden lg:inline text-[11px] text-dim truncate max-w-[110px]">
              · {branchName}
            </span>
          )}
        </div>

        {onToggleSidebar && (
          <button
            type="button"
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? 'Buka sidebar (Ctrl+B)' : 'Kecilkan sidebar (Ctrl+B)'}
            aria-label={isSidebarCollapsed ? 'Buka sidebar' : 'Kecilkan sidebar'}
            className="w-7 h-7 flex items-center justify-center rounded-md text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {isSidebarCollapsed ? (
              <PanelLeftOpen size={15} strokeWidth={1.75} />
            ) : (
              <PanelLeftClose size={15} strokeWidth={1.75} />
            )}
          </button>
        )}

        <div className="h-4 w-px bg-line mx-0.5" />

        <h2 data-tauri-drag-region className="text-xs font-semibold text-body truncate">
          {title}
        </h2>
      </div>

      {/* Draggable Flex Spacer */}
      <div data-tauri-drag-region className="flex-1 h-full min-w-4" />

      {/* Right: Operational Controls + Window Controls */}
      <div className="flex items-center h-full shrink-0">
        <div
          onMouseDown={(e) => e.stopPropagation()}
          className="flex items-center gap-1.5 pr-2.5"
        >
          {/* LAN status */}
          <span
            className="inline-flex items-center gap-1 text-[11px] font-medium text-dim px-2 py-0.5 rounded-md border border-line bg-muted/50 tnum"
            title={`LAN: ${lanPeerCount} perangkat`}
          >
            <Radio size={11} strokeWidth={1.75} className={lanPeerCount > 1 ? 'text-success' : 'text-dim'} />
            <span>LAN {lanPeerCount}</span>
          </span>

          {/* Cloud sync status */}
          <span
            className={`inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-md border ${
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
                <Cloud size={11} strokeWidth={1.75} />
                <span>Online</span>
              </>
            ) : status === 'connecting' ? (
              <>
                <RefreshCw size={11} strokeWidth={1.75} className="animate-spin" />
                <span>Sync</span>
              </>
            ) : (
              <>
                <CloudOff size={11} strokeWidth={1.75} />
                <span>Lokal</span>
              </>
            )}
          </span>

          {/* Zoom Controls (Desktop >= 1024px) */}
          <div className="hidden lg:flex items-center bg-muted/60 border border-line rounded-md p-0.5">
            <button
              type="button"
              onClick={zoomOut}
              aria-label="Perkecil tampilan"
              className="text-dim hover:text-heading transition-colors p-0.5 rounded hover:bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Perkecil (Ctrl -)"
            >
              <ZoomOut size={12} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onClick={reset}
              aria-label="Reset zoom"
              className="text-[11px] font-semibold text-dim hover:text-heading px-1 rounded transition-colors hover:bg-card font-mono tnum cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Reset 100% (Ctrl 0)"
            >
              {zoom}%
            </button>
            <button
              type="button"
              onClick={zoomIn}
              aria-label="Perbesar tampilan"
              className="text-dim hover:text-heading transition-colors p-0.5 rounded hover:bg-card cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Perbesar (Ctrl +)"
            >
              <ZoomIn size={12} strokeWidth={1.75} />
            </button>
          </div>

          {/* Host QR */}
          {onOpenHostQr && (
            <button
              type="button"
              onClick={onOpenHostQr}
              aria-label="QR Akses LAN"
              className="w-7 h-7 flex items-center justify-center text-dim hover:text-heading rounded-md hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="QR Akses LAN"
            >
              <QrCode size={15} strokeWidth={1.75} />
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
                className="inline-flex items-center gap-1 h-7 px-2 bg-primary-soft hover:bg-primary/15 text-primary border border-primary/25 rounded-md text-[11px] font-semibold transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                title={`Update ${verLabel}`}
              >
                <ArrowUpCircle size={13} strokeWidth={1.75} />
                <span>{verLabel}</span>
              </button>
            );
          })()}

          {/* Theme Toggle */}
          <button
            type="button"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Ganti tema"
            className="w-7 h-7 flex items-center justify-center text-dim hover:text-heading rounded-md hover:bg-muted transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            title={theme === 'dark' ? 'Mode terang' : 'Mode gelap'}
          >
            {theme === 'dark' ? <Sun size={15} strokeWidth={1.75} /> : <Moon size={15} strokeWidth={1.75} />}
          </button>

          {/* AI Chat */}
          {onOpenAIChat && (
            <button
              type="button"
              onClick={onOpenAIChat}
              aria-label="Buka Kivo AI"
              className="inline-flex items-center gap-1.5 h-7 px-2 bg-card hover:bg-muted text-heading border border-line hover:border-line-strong rounded-md font-semibold text-xs transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              title="Kivo AI"
            >
              <MessageSquare size={13} strokeWidth={1.75} className="text-primary" aria-hidden="true" />
              <span>AI</span>
            </button>
          )}
        </div>

        {/* Native Window Controls (Desktop Tauri only) */}
        {isTauri() && (
          <div className="flex items-center h-full border-l border-line">
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={minimize}
              aria-label="Perkecil jendela"
              className="h-full w-10 flex items-center justify-center text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer"
              title="Perkecil"
            >
              <Minus size={13} strokeWidth={1.75} />
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={toggleMax}
              aria-label={isMaximized ? 'Pulihkan jendela' : 'Perbesar jendela'}
              className="h-full w-10 flex items-center justify-center text-dim hover:text-heading hover:bg-muted transition-colors cursor-pointer"
              title={isMaximized ? 'Pulihkan' : 'Perbesar'}
            >
              {isMaximized ? <Copy size={11} strokeWidth={1.75} /> : <Square size={11} strokeWidth={1.75} />}
            </button>
            <button
              type="button"
              onMouseDown={(e) => e.stopPropagation()}
              onClick={close}
              aria-label="Tutup aplikasi"
              className="h-full w-10 flex items-center justify-center text-dim hover:bg-danger hover:text-white transition-colors cursor-pointer"
              title="Tutup"
            >
              <X size={13} strokeWidth={1.75} />
            </button>
          </div>
        )}
      </div>
    </header>
  );
}
