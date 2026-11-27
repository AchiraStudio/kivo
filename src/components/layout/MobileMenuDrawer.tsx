import {
  Truck,
  Users,
  Settings,
  Sun,
  Moon,
  SunMoon,
  LogOut,
  QrCode,
  MessageSquare,
  ArrowUpCircle,
  Server,
  type LucideIcon,
} from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useTheme } from '../ThemeProvider';
import { usePermissions } from '../../lib/permissions';
import { useUpdaterStore } from '../../store/UpdaterStore';
import { getHostUrl, isRemoteClient, isMobileTauri } from '../../lib/runtime';
import Sheet from '../ui/Sheet';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onOpenHostQr: () => void;
  onOpenAIChat?: () => void;
  onChangeHost?: () => void;
  onLogout: () => void;
}

function Tile({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-h-[88px] flex flex-col items-center justify-center gap-2 rounded-2xl border text-center px-2 cursor-pointer active:scale-[0.97] transition-transform ${
        active ? 'bg-primary-soft border-primary/40 text-primary' : 'bg-card border-line text-heading'
      }`}
    >
      <Icon size={24} strokeWidth={1.7} className={active ? 'text-primary' : 'text-primary'} />
      <span className="text-xs font-bold leading-tight">{label}</span>
    </button>
  );
}

/** Account + "everything else" sheet opened from the Menu tab or the avatar. */
export default function MobileMenuDrawer({
  isOpen,
  onClose,
  activeMenu,
  setActiveMenu,
  onOpenHostQr,
  onOpenAIChat,
  onChangeHost,
  onLogout,
}: MobileMenuDrawerProps) {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { can } = usePermissions();
  const { updateInfo, openModal } = useUpdaterStore();
  const remote = isRemoteClient();

  const go = (menuId: string) => {
    setActiveMenu(menuId);
    onClose();
  };
  const run = (fn?: () => void) => () => {
    onClose();
    fn?.();
  };

  const tiles = [
    { id: 'purchasing', label: 'Pembelian', icon: Truck, show: can('purchasing.view') || can('purchasing.create') },
    { id: 'customers', label: 'Pelanggan & Promo', icon: Users, show: can('crm.customers') || can('promos.manage') },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: Settings,
      show:
        can('settings.general') ||
        can('settings.hardware') ||
        can('settings.users') ||
        can('settings.database') ||
        can('settings.lan'),
    },
  ].filter((t) => t.show);

  const verLabel = updateInfo?.latest_version
    ? updateInfo.latest_version.startsWith('v')
      ? updateInfo.latest_version
      : `v${updateInfo.latest_version}`
    : '';

  const THEMES = [
    { id: 'system' as const, label: 'Otomatis', icon: SunMoon },
    { id: 'light' as const, label: 'Terang', icon: Sun },
    { id: 'dark' as const, label: 'Gelap', icon: Moon },
  ];

  return (
    <Sheet
      isOpen={isOpen}
      onClose={onClose}
      footer={
        <button
          type="button"
          onClick={run(onLogout)}
          className="w-full h-12 rounded-xl border border-danger/30 text-danger font-bold text-sm flex items-center justify-center gap-2 cursor-pointer active:bg-danger-soft"
        >
          <LogOut size={17} strokeWidth={1.9} />
          Keluar Akun
        </button>
      }
    >
      <div className="flex items-center gap-3 pb-4 pt-1">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0"
          style={{ backgroundColor: user?.avatar_color || '#3f434c' }}
        >
          {user?.name?.slice(0, 2).toUpperCase() || 'KV'}
        </div>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-heading truncate">{user?.name || 'Kasir'}</p>
          <p className="text-xs text-dim capitalize">{user?.role || 'Staff'}</p>
        </div>
      </div>

      {tiles.length > 0 && (
        <div className="grid grid-cols-3 gap-2.5 mb-3">
          {tiles.map((t) => (
            <Tile key={t.id} icon={t.icon} label={t.label} active={activeMenu === t.id} onClick={() => go(t.id)} />
          ))}
        </div>
      )}

      <div className="space-y-2 mb-4">
        {onOpenAIChat && (
          <button
            type="button"
            onClick={run(onOpenAIChat)}
            className="w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl border border-line bg-card text-sm font-bold text-heading cursor-pointer active:bg-muted"
          >
            <MessageSquare size={19} strokeWidth={1.8} className="text-primary" />
            Kivo AI
          </button>
        )}

        {remote ? (
          <div className="flex items-center gap-3 px-4 min-h-[52px] rounded-2xl border border-line bg-card">
            <Server size={19} strokeWidth={1.8} className="text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-dim leading-tight">Komputer kasir</p>
              <p className="text-sm font-mono font-semibold text-heading truncate">{getHostUrl().replace(/^http:\/\//, '')}</p>
            </div>
            {onChangeHost && isMobileTauri() && (
              <button type="button" onClick={run(onChangeHost)} className="h-9 px-3 rounded-lg text-xs font-bold text-primary cursor-pointer active:bg-primary-soft">
                Ganti
              </button>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={run(onOpenHostQr)}
            className="w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl border border-line bg-card text-sm font-bold text-heading cursor-pointer active:bg-muted"
          >
            <QrCode size={19} strokeWidth={1.8} className="text-primary" />
            QR Akses LAN
          </button>
        )}

        {updateInfo?.has_update && (
          <button
            type="button"
            onClick={run(openModal)}
            className="w-full min-h-[52px] flex items-center gap-3 px-4 rounded-2xl border border-primary/30 bg-primary-soft text-sm font-bold text-primary cursor-pointer"
          >
            <ArrowUpCircle size={19} strokeWidth={1.8} />
            Update {verLabel}
          </button>
        )}
      </div>

      <p className="text-xs font-bold text-dim mb-2 px-1">Tampilan</p>
      <div className="p-1 bg-muted rounded-2xl border border-line grid grid-cols-3 gap-1">
        {THEMES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTheme(id)}
            aria-pressed={theme === id}
            className={`h-11 flex items-center justify-center gap-1.5 rounded-xl text-xs font-bold cursor-pointer transition-colors ${
              theme === id ? 'bg-card text-heading border border-line' : 'text-dim border border-transparent'
            }`}
          >
            <Icon size={15} strokeWidth={1.8} />
            {label}
          </button>
        ))}
      </div>

      <p className="text-center text-[11px] text-dim mt-4">Kivo v{__APP_VERSION__}</p>
    </Sheet>
  );
}
