import { Truck, Users, Settings, Sun, Moon, LogOut, QrCode, ChevronRight } from 'lucide-react';
import { useAuthStore } from '../../store/AuthStore';
import { useTheme } from '../ThemeProvider';
import { usePermissions } from '../../lib/permissions';
import Drawer from '../ui/Drawer';
import Button from '../ui/Button';

interface MobileMenuDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onOpenHostQr: () => void;
  onLogout: () => void;
}

export default function MobileMenuDrawer({
  isOpen,
  onClose,
  activeMenu,
  setActiveMenu,
  onOpenHostQr,
  onLogout,
}: MobileMenuDrawerProps) {
  const { user } = useAuthStore();
  const { theme, setTheme } = useTheme();
  const { can } = usePermissions();

  const handleSelect = (menuId: string) => {
    setActiveMenu(menuId);
    onClose();
  };

  const SECONDARY_ITEMS = [
    {
      id: 'purchasing',
      label: 'Pembelian',
      icon: Truck,
      show: can('purchasing.view') || can('purchasing.create'),
    },
    {
      id: 'customers',
      label: 'Pelanggan & Promo',
      icon: Users,
      show: can('crm.customers') || can('promos.manage'),
    },
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
  ];

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      size="sm"
      title={user?.name || 'Kasir'}
      subtitle={user?.role || 'Staff'}
      icon={
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xs shrink-0"
          style={{ backgroundColor: user?.avatar_color || '#3f434c' }}
        >
          {user?.name?.slice(0, 2).toUpperCase() || 'KV'}
        </div>
      }
      footer={
        <Button
          variant="outline"
          size="md"
          fullWidth
          onClick={() => {
            onClose();
            onLogout();
          }}
          className="text-danger hover:bg-danger-soft border-danger/30"
        >
          <LogOut size={15} strokeWidth={1.75} />
          Keluar Akun
        </Button>
      }
    >
      <div className="space-y-5">
        <div className="space-y-1">
          {SECONDARY_ITEMS.filter(i => i.show).map((item) => {
            const Icon = item.icon;
            const isActive = activeMenu === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                className={`w-full min-h-[44px] flex items-center justify-between px-3 rounded-lg text-sm font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                  isActive
                    ? 'bg-primary-soft text-primary font-semibold'
                    : 'text-heading hover:bg-muted'
                }`}
              >
                <span className="flex items-center gap-3 min-w-0">
                  <Icon size={17} strokeWidth={1.75} className={isActive ? 'text-primary' : 'text-dim'} />
                  <span className="truncate">{item.label}</span>
                </span>
                <ChevronRight size={15} className={isActive ? 'text-primary' : 'text-dim'} />
              </button>
            );
          })}
        </div>

        <div className="border-t border-line pt-4">
          <button
            type="button"
            onClick={() => {
              onClose();
              onOpenHostQr();
            }}
            className="w-full min-h-[44px] flex items-center justify-between px-3 rounded-lg border border-line bg-card hover:bg-muted text-sm font-medium text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <span className="flex items-center gap-3">
              <QrCode size={17} strokeWidth={1.75} className="text-primary" />
              <span>QR Akses LAN</span>
            </span>
            <ChevronRight size={15} className="text-dim" />
          </button>
        </div>

        <div className="border-t border-line pt-4">
          <p className="text-xs font-semibold text-dim mb-2">Tema</p>
          <div className="p-1 bg-muted rounded-lg border border-line flex items-center gap-1">
            <button
              type="button"
              onClick={() => setTheme('light')}
              className={`flex-1 min-h-[38px] flex items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                theme === 'light'
                  ? 'bg-card text-heading border border-line'
                  : 'text-dim hover:text-heading border border-transparent'
              }`}
            >
              <Sun size={14} strokeWidth={1.75} />
              <span>Terang</span>
            </button>
            <button
              type="button"
              onClick={() => setTheme('dark')}
              className={`flex-1 min-h-[38px] flex items-center justify-center gap-2 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                theme === 'dark'
                  ? 'bg-card text-heading border border-line'
                  : 'text-dim hover:text-heading border border-transparent'
              }`}
            >
              <Moon size={14} strokeWidth={1.75} />
              <span>Gelap</span>
            </button>
          </div>
        </div>
      </div>
    </Drawer>
  );
}
