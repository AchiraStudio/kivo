import { useEffect, useState } from 'react';
import { MessageSquare, WifiOff, Wifi, RefreshCw } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useSyncStore } from '../../store/SyncStore';
import { getSettings } from '../../lib/api';
import { useHostReachability } from '../../hooks/useHostReachability';
import { getHostUrl } from '../../lib/runtime';

interface MobileAppBarProps {
  title: string;
  onOpenMenu: () => void;
  onOpenAIChat?: () => void;
  onChangeHost?: () => void;
}

/** Compact top bar for phones: where am I, am I connected, who am I. */
export default function MobileAppBar({ title, onOpenMenu, onOpenAIChat, onChangeHost }: MobileAppBarProps) {
  const { user } = useAuthStore();
  const { status } = useSyncStore();
  const { link, remote, recheck } = useHostReachability();
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const co = settings.find((s) => s.key === 'company_name')?.value;
        if (co) setCompanyName(co);
      })
      .catch(() => {});
  }, []);

  const offline = remote && link === 'offline';

  const statusPill = remote ? (
    <button
      type="button"
      onClick={recheck}
      aria-label={offline ? 'Terputus dari komputer kasir. Ketuk untuk cek ulang' : 'Terhubung ke komputer kasir'}
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-bold border cursor-pointer ${
        offline
          ? 'bg-danger-soft text-danger border-danger/30'
          : link === 'checking'
            ? 'bg-muted text-dim border-line'
            : 'bg-success-soft text-success border-success/25'
      }`}
    >
      {offline ? <WifiOff size={12} /> : link === 'checking' ? <RefreshCw size={12} className="animate-spin" /> : <Wifi size={12} />}
      {offline ? 'Terputus' : link === 'checking' ? 'Cek' : 'Terhubung'}
    </button>
  ) : (
    <span
      className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full text-[11px] font-bold border ${
        status === 'connected' ? 'bg-success-soft text-success border-success/25' : 'bg-muted text-dim border-line'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${status === 'connected' ? 'bg-success' : 'bg-dim'}`} />
      {status === 'connected' ? 'Online' : 'Lokal'}
    </span>
  );

  return (
    <>
      <header className="md:hidden shrink-0 h-14 px-4 flex items-center justify-between gap-2 bg-card border-b border-line select-none z-30">
        <div className="min-w-0">
          <h1 className="text-[17px] font-extrabold tracking-tight text-heading leading-tight truncate">{title}</h1>
          {companyName && <p className="text-[11px] text-dim leading-tight truncate">{companyName}</p>}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {statusPill}
          {onOpenAIChat && (
            <button
              type="button"
              onClick={onOpenAIChat}
              aria-label="Buka Kivo AI"
              className="w-10 h-10 flex items-center justify-center rounded-full text-primary active:bg-primary-soft cursor-pointer"
            >
              <MessageSquare size={19} strokeWidth={1.9} />
            </button>
          )}
          <button
            type="button"
            onClick={onOpenMenu}
            aria-label="Buka menu akun"
            className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0 cursor-pointer active:scale-95 transition-transform"
            style={{ backgroundColor: user?.avatar_color || '#3f434c' }}
          >
            {user?.name?.slice(0, 2).toUpperCase() || 'KV'}
          </button>
        </div>
      </header>

      {offline && (
        <div role="status" className="md:hidden shrink-0 px-4 py-2 bg-danger-soft border-b border-danger/20 flex items-center justify-between gap-3 text-xs">
          <span className="text-danger font-medium leading-snug">
            Tidak terhubung ke <span className="font-mono">{getHostUrl().replace(/^http:\/\//, '')}</span>. Pastikan Wi-Fi sama dan komputer kasir menyala.
          </span>
          {onChangeHost && (
            <button type="button" onClick={onChangeHost} className="shrink-0 h-8 px-2.5 rounded-lg border border-danger/30 text-danger font-bold cursor-pointer active:bg-danger/10">
              Ganti
            </button>
          )}
        </div>
      )}
    </>
  );
}
