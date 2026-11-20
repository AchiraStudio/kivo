import { useState, useEffect } from 'react';
import {
  LayoutDashboard, Package, ShoppingCart, Users, Settings,
  FileText, LogOut, Truck, RefreshCw, PanelLeftClose, PanelLeftOpen,
  CheckCircle2, AlertTriangle, LucideIcon
} from 'lucide-react';
import { listen } from '../../lib/events';
import { getLowStockAlerts, logoutUser, getSyncStatus, getSettings, SyncStatus, LanSyncProgress, getLanStatus } from '../../lib/api';
import { useAuthStore } from '../../store/AuthStore';
import ConfirmModal from '../ui/ConfirmModal';
import { usePermissions } from '../../lib/permissions';
import KivoLogo from '../common/KivoLogo';

interface SidebarProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onOpenAIChat?: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

interface SyncEventPayload {
  percent: number;
  table_name: string;
}

interface MenuItem {
  id: string;
  icon: LucideIcon;
  label: string;
  show: boolean;
  badge?: number | null;
}

export default function Sidebar({ activeMenu, setActiveMenu, isCollapsed = false, onToggleCollapse }: SidebarProps) {
  const { can } = usePermissions();
  const [lowStockCount, setLowStockCount] = useState(0);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);
  const [companyName, setCompanyName] = useState('Kivo');
  const [branchName, setBranchName] = useState('Cabang Utama');
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [lanSyncProgress, setLanSyncProgress] = useState<LanSyncProgress | null>(null);
  const [lanParentInfo, setLanParentInfo] = useState<{ ip: string; name?: string } | null>(null);
  const [bgSyncProgress, setBgSyncProgress] = useState<{
    active: boolean;
    type: 'push' | 'pull';
    percent: number;
    table_name: string;
  } | null>(null);
  const { user, token, clearAuth } = useAuthStore();

  useEffect(() => {
    getSettings()
      .then((settings) => {
        const co = settings.find(s => s.key === 'company_name');
        const br = settings.find(s => s.key === 'branch_name');
        if (co?.value) setCompanyName(co.value);
        if (br?.value) setBranchName(br.value);
      })
      .catch(() => {});

    getLowStockAlerts('main')
      .then((alerts) => setLowStockCount(alerts.length))
      .catch(() => {});

    getSyncStatus()
      .then(setSyncStatus)
      .catch(() => {});

    const checkLan = () => {
      getLanStatus()
        .then((s) => {
          if (s.role === 'child' && s.paired_parent_ip) {
            setLanParentInfo({ ip: s.paired_parent_ip, name: s.paired_parent_name });
          } else {
            setLanParentInfo(null);
          }
        })
        .catch(() => {});
    };
    checkLan();
    const lanInterval = setInterval(checkLan, 5000);

    let unlistenPush: () => void;
    let unlistenPull: () => void;
    let unlistenLanStatus: () => void;

    listen('kivo:lan_status_updated', () => checkLan())
      .then(fn => { unlistenLanStatus = fn; });

    const handleProgress = (type: 'push' | 'pull', payload: SyncEventPayload) => {
      const rounded = Math.round(payload.percent);
      setBgSyncProgress({
        active: rounded < 100,
        type,
        percent: rounded,
        table_name: payload.table_name
      });
      if (rounded >= 100) {
        setTimeout(() => setBgSyncProgress(null), 2500);
      }
    };

    listen<SyncEventPayload>('sync-push-progress', (e) => handleProgress('push', e.payload))
      .then(fn => { unlistenPush = fn; });

    listen<SyncEventPayload>('sync-pull-progress', (e) => handleProgress('pull', e.payload))
      .then(fn => { unlistenPull = fn; });

    let unlistenLanProgress: () => void;
    listen<LanSyncProgress>('kivo:lan_sync_progress', (e) => {
      const p = e.payload;
      setLanSyncProgress(p);
      if (!p.active && (p.stage === 'complete' || p.percent >= 100)) {
        setTimeout(() => {
          setLanSyncProgress(prev => (prev?.stage === 'complete' ? null : prev));
        }, 4000);
      }
    }).then(fn => { unlistenLanProgress = fn; });

    return () => {
      clearInterval(lanInterval);
      if (unlistenPush) unlistenPush();
      if (unlistenPull) unlistenPull();
      if (unlistenLanProgress) unlistenLanProgress();
      if (unlistenLanStatus) unlistenLanStatus();
    };
  }, []);

  const handleLogout = async () => {
    if (token) await logoutUser(token);
    clearAuth();
  };

  const menuItems: MenuItem[] = [
    { id: 'dashboard',  icon: LayoutDashboard, label: 'Ringkasan',  show: true },
    { id: 'pos',        icon: ShoppingCart,    label: 'Kasir',      show: can('sales.create') },
    { id: 'inventory',  icon: Package,         label: 'Inventaris', show: can('items.view') || can('inventory.view'), badge: lowStockCount > 0 ? lowStockCount : null },
    { id: 'purchasing', icon: Truck,           label: 'Pembelian',  show: can('purchasing.view') || can('purchasing.create') },
    { id: 'customers',  icon: Users,           label: 'Pelanggan',  show: can('crm.customers') || can('promos.manage') },
    { id: 'reports',    icon: FileText,        label: 'Laporan',    show: can('reports.view') || can('accounting.manage') },
    { id: 'settings',   icon: Settings,        label: 'Pengaturan', show: can('settings.general') || can('settings.hardware') || can('settings.users') || can('settings.database') || can('settings.lan') },
  ].filter(item => item.show);

  return (
    <>
      <aside
        className={`hidden md:flex ${
          isCollapsed ? 'w-16' : 'w-56'
        } bg-sidebar flex-col h-full shrink-0 border-r border-sidebar-line z-20 transition-[width] duration-200 select-none`}
      >
        <SidebarBrand
          isCollapsed={isCollapsed}
          companyName={companyName}
          branchName={branchName}
          onToggleCollapse={onToggleCollapse}
        />

        <SidebarNav
          isCollapsed={isCollapsed}
          menuItems={menuItems}
          activeMenu={activeMenu}
          onSelect={setActiveMenu}
        />

        <div className={`mt-auto ${isCollapsed ? 'px-2 pb-2.5 items-center' : 'px-2.5 pb-2.5'} flex flex-col gap-1.5 border-t border-sidebar-line pt-2.5`}>
          <SidebarSyncStatus
            isCollapsed={isCollapsed}
            bgSyncProgress={bgSyncProgress}
            lanSyncProgress={lanSyncProgress}
            lanParentInfo={lanParentInfo}
            syncStatus={syncStatus}
          />

          <SidebarUserProfile
            isCollapsed={isCollapsed}
            user={user}
            onClick={() => setShowLogoutModal(true)}
          />
        </div>
      </aside>

      {showLogoutModal && (
        <ConfirmModal
          title="Keluar Akun"
          message={`Keluar dari akun ${user?.name}?`}
          confirmLabel="Keluar"
          cancelLabel="Batal"
          variant="logout"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutModal(false)}
        />
      )}
    </>
  );
}

function SidebarBrand({
  isCollapsed,
  companyName,
  branchName,
  onToggleCollapse,
}: {
  isCollapsed: boolean;
  companyName: string;
  branchName: string;
  onToggleCollapse?: () => void;
}) {
  if (isCollapsed) {
    return (
      <div className="h-13 flex items-center justify-center px-2 border-b border-sidebar-line">
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Buka sidebar (Ctrl+B)"
          aria-label="Buka sidebar"
          className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted transition-colors relative group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <div className="flex items-center justify-center group-hover:opacity-0 transition-opacity">
            <KivoLogo size={24} />
          </div>
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-heading">
            <PanelLeftOpen size={17} strokeWidth={1.75} />
          </div>
        </button>
      </div>
    );
  }

  return (
    <div className="h-13 flex items-center px-3.5 justify-between border-b border-sidebar-line">
      <div className="flex items-center min-w-0 gap-2.5">
        <KivoLogo size={24} />
        <div className="min-w-0">
          <p className="text-sm leading-tight text-heading font-bold truncate">{companyName}</p>
          <p className="text-[11px] text-dim truncate">{branchName}</p>
        </div>
      </div>
      {onToggleCollapse && (
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Kecilkan sidebar (Ctrl+B)"
          aria-label="Kecilkan sidebar"
          className="w-7 h-7 flex items-center justify-center rounded-lg text-dim hover:text-heading hover:bg-muted transition-colors shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <PanelLeftClose size={15} strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

function SidebarNav({
  isCollapsed,
  menuItems,
  activeMenu,
  onSelect,
}: {
  isCollapsed: boolean;
  menuItems: MenuItem[];
  activeMenu: string;
  onSelect: (id: string) => void;
}) {
  return (
    <nav
      aria-label="Navigasi utama"
      className={`flex-1 py-2.5 flex flex-col gap-0.5 ${isCollapsed ? 'px-2 items-center' : 'px-2.5'} overflow-y-auto custom-scrollbar`}
    >
      {menuItems.map((item) => {
        const Icon = item.icon;
        const isActive = activeMenu === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            title={isCollapsed ? item.label : undefined}
            aria-current={isActive ? 'page' : undefined}
            className={`relative flex items-center ${
              isCollapsed ? 'w-10 h-10 justify-center p-0' : 'w-full px-3 h-9 text-left'
            } rounded-lg transition-colors duration-150 group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              isActive
                ? 'bg-primary-soft text-primary font-semibold'
                : 'text-body hover:bg-muted hover:text-heading font-medium'
            }`}
          >
            <Icon
              size={17}
              strokeWidth={isActive ? 2 : 1.75}
              className={`shrink-0 ${isCollapsed ? '' : 'mr-2.5'} ${
                isActive ? 'text-primary' : 'text-dim group-hover:text-heading'
              }`}
            />
            {!isCollapsed && (
              <span className="text-[13px] truncate">{item.label}</span>
            )}

            {item.badge !== null && item.badge !== undefined && (
              isCollapsed ? (
                <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-danger ring-2 ring-sidebar" />
              ) : (
                <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full tnum ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'bg-danger-soft text-danger'
                }`}>
                  {item.badge}
                </span>
              )
            )}
          </button>
        );
      })}
    </nav>
  );
}

function CloudSyncProgressBar({
  isCollapsed,
  bgSyncProgress,
}: {
  isCollapsed: boolean;
  bgSyncProgress: { active: boolean; type: 'push' | 'pull'; percent: number; table_name: string };
}) {
  if (isCollapsed) {
    return (
      <div
        title={`Cloud (${bgSyncProgress.type === 'push' ? 'Push' : 'Pull'}): ${bgSyncProgress.percent}%`}
        className="w-10 h-10 justify-center bg-success-soft border border-success/20 rounded-lg flex items-center"
      >
        <RefreshCw size={15} className="animate-spin text-success" />
      </div>
    );
  }

  return (
    <div
      title={`Cloud (${bgSyncProgress.type === 'push' ? 'Push' : 'Pull'}): ${bgSyncProgress.percent}%`}
      className="px-2.5 py-2 bg-success-soft border border-success/20 rounded-lg"
    >
      <div className="flex items-center justify-between text-[11px] font-semibold text-success mb-1.5">
        <span className="flex items-center gap-1.5 truncate">
          <RefreshCw size={12} className="animate-spin shrink-0" />
          <span className="truncate">{bgSyncProgress.type === 'push' ? 'Sync keluar' : 'Sync masuk'}</span>
        </span>
        <span className="font-mono text-[10px] tnum shrink-0">{bgSyncProgress.percent}%</span>
      </div>
      <div className="w-full h-1 bg-line rounded-full overflow-hidden">
        <div
          className="h-full bg-success rounded-full transition-all duration-200"
          style={{ width: `${bgSyncProgress.percent}%` }}
        />
      </div>
    </div>
  );
}

function LanSyncProgressBar({
  isCollapsed,
  lanSyncProgress,
}: {
  isCollapsed: boolean;
  lanSyncProgress: LanSyncProgress;
}) {
  const isError = lanSyncProgress.stage === 'error';
  const isComplete = lanSyncProgress.stage === 'complete';

  const toneClass = isError
    ? 'bg-danger-soft border-danger/20 text-danger'
    : isComplete
    ? 'bg-success-soft border-success/20 text-success'
    : 'bg-info-soft border-info/20 text-info';

  const barBgClass = isError ? 'bg-danger' : isComplete ? 'bg-success' : 'bg-info';

  if (isCollapsed) {
    return (
      <div
        title={`LAN: ${lanSyncProgress.message} (${lanSyncProgress.percent}%)`}
        className={`w-10 h-10 justify-center border rounded-lg flex items-center ${toneClass}`}
      >
        {lanSyncProgress.active ? (
          <RefreshCw size={15} className="animate-spin" />
        ) : isError ? (
          <AlertTriangle size={15} />
        ) : (
          <CheckCircle2 size={15} />
        )}
      </div>
    );
  }

  return (
    <div
      title={`LAN: ${lanSyncProgress.message} (${lanSyncProgress.percent}%)`}
      className={`px-2.5 py-2 border rounded-lg ${toneClass}`}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold mb-1.5">
        <span className="flex items-center gap-1.5 truncate">
          {lanSyncProgress.active ? (
            <RefreshCw size={12} className="animate-spin shrink-0" />
          ) : isError ? (
            <AlertTriangle size={12} className="shrink-0" />
          ) : (
            <CheckCircle2 size={12} className="shrink-0" />
          )}
          <span className="truncate">{lanSyncProgress.message}</span>
        </span>
        <span className="font-mono text-[10px] tnum shrink-0">{lanSyncProgress.percent}%</span>
      </div>
      <div className="w-full h-1 bg-line rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-200 ${barBgClass}`}
          style={{ width: `${lanSyncProgress.percent}%` }}
        />
      </div>
    </div>
  );
}

function LanParentBadge({
  isCollapsed,
  lanParentInfo,
}: {
  isCollapsed: boolean;
  lanParentInfo: { ip: string; name?: string };
}) {
  return (
    <div
      title={`Terhubung ke host: ${lanParentInfo.name || lanParentInfo.ip}`}
      className={`bg-success-soft border border-success/20 rounded-lg flex items-center ${
        isCollapsed ? 'w-10 h-10 justify-center' : 'px-2.5 py-1.5 justify-between'
      }`}
    >
      <div className="flex items-center gap-1.5 truncate">
        <span className="inline-flex rounded-full h-2 w-2 bg-success shrink-0" />
        {!isCollapsed && (
          <span className="text-[11px] font-semibold text-success truncate">
            {lanParentInfo.name || 'Host Induk'}
          </span>
        )}
      </div>
      {!isCollapsed && (
        <span className="text-[10px] font-mono font-semibold text-success shrink-0">LAN</span>
      )}
    </div>
  );
}

function SidebarSyncStatus({
  isCollapsed,
  bgSyncProgress,
  lanSyncProgress,
  lanParentInfo,
  syncStatus,
}: {
  isCollapsed: boolean;
  bgSyncProgress: { active: boolean; type: 'push' | 'pull'; percent: number; table_name: string } | null;
  lanSyncProgress: LanSyncProgress | null;
  lanParentInfo: { ip: string; name?: string } | null;
  syncStatus: SyncStatus | null;
}) {
  const showLan = lanSyncProgress && (lanSyncProgress.active || lanSyncProgress.stage === 'complete' || lanSyncProgress.stage === 'error');

  return (
    <>
      {bgSyncProgress?.active && (
        <CloudSyncProgressBar isCollapsed={isCollapsed} bgSyncProgress={bgSyncProgress} />
      )}

      {showLan && (
        <LanSyncProgressBar isCollapsed={isCollapsed} lanSyncProgress={lanSyncProgress} />
      )}

      {lanParentInfo && (
        <LanParentBadge isCollapsed={isCollapsed} lanParentInfo={lanParentInfo} />
      )}

      {!isCollapsed && syncStatus?.workspace_name && (
        <div className="px-2.5 py-1.5 bg-muted border border-line rounded-lg flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-heading truncate">{syncStatus.workspace_name}</span>
          <span className="text-[10px] font-mono text-dim shrink-0">{syncStatus.workspace_code}</span>
        </div>
      )}
    </>
  );
}

function SidebarUserProfile({
  isCollapsed,
  user,
  onClick,
}: {
  isCollapsed: boolean;
  user: any;
  onClick: () => void;
}) {
  const roleLabel = () => {
    const r = user?.role?.toLowerCase();
    if (r === 'owner') return 'Owner';
    if (r === 'admin') return 'Admin';
    return 'Staff';
  };

  if (isCollapsed) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={`${user?.name} (${roleLabel()}) - Keluar`}
        aria-label="Keluar akun"
        className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-danger-soft transition-colors cursor-pointer group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px]"
          style={{ backgroundColor: user?.avatar_color || '#3f434c' }}
        >
          {user?.name?.substring(0, 2).toUpperCase() || 'U'}
        </div>
        <div className="absolute inset-0 rounded-lg bg-danger text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <LogOut size={15} strokeWidth={1.75} />
        </div>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={`${user?.name} (${roleLabel()}) - Keluar`}
      className="w-full p-2 rounded-lg border border-transparent hover:bg-danger-soft hover:border-danger/25 flex items-center justify-between group transition-colors cursor-pointer text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white font-bold text-[11px] shrink-0"
          style={{ backgroundColor: user?.avatar_color || '#3f434c' }}
        >
          {user?.name?.substring(0, 2).toUpperCase() || 'U'}
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold leading-tight text-heading truncate">{user?.name}</p>
          <p className="text-[11px] text-dim truncate">{roleLabel()}</p>
        </div>
      </div>
      <LogOut size={14} strokeWidth={1.75} className="text-dim group-hover:text-danger transition-colors shrink-0 ml-1" />
    </button>
  );
}
