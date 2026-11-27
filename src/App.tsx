import { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/layout/Sidebar';
import Topbar from './components/layout/Topbar';
import Dashboard from './components/Dashboard';
import TitleBar from './components/TitleBar';
import AIChat from './components/ai/AIChat';
import InventoryPage from './pages/inventory/InventoryPage';
import PurchasingPage from './pages/purchasing/PurchasingPage';
import CustomerPromoPage from './pages/customers/CustomerPromoPage';
import ReportsAccountingPage from './pages/reports/ReportsAccountingPage';
import ItemDrawer from './pages/inventory/ItemDrawer';
import RapidRegisterModal from './pages/inventory/RapidRegisterModal';
import POS from './pages/pos/POS';
import Settings from './pages/settings/Settings';
import LoginPage from './pages/auth/LoginPage';
import ContextMenu from './components/layout/ContextMenu';
import { useAuthStore } from './store/AuthStore';
import { getCurrentUser, kickCashDrawer, getSyncStatus, getSettings, invoke } from './lib/api';
import { supabase } from './lib/supabase';
import { useSyncStore } from './store/SyncStore';
import { useZoomStore } from './store/ZoomStore';
import { Package, Loader2 } from 'lucide-react';
import { useRealtimeSync } from './hooks/useRealtimeSync';
import SetupWizard from './pages/onboarding/SetupWizard';
import MobileNav from './components/layout/MobileNav';
import MobileMenuDrawer from './components/layout/MobileMenuDrawer';
import MobileAppBar from './components/layout/MobileAppBar';
import { useMobileBack } from './hooks/useMobileBack';
import HostQrModal from './components/common/HostQrModal';
import { logoutUser, setSetting } from './lib/api';
import { isTauri, isDesktopTauri, isMobilePlatform, isMobileTauri, isRemoteClient, getMobileMode, getHostUrl, SKIP_AUTO_JOIN_KEY, skipAutoJoin } from './lib/runtime';
import MobileConnect from './pages/mobile/MobileConnect';
import { useUpdaterStore } from './store/UpdaterStore';
import UpdateModal from './components/updater/UpdateModal';

interface MainContentProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  refreshTrigger: number;
  setEditItemId: (id: string | null) => void;
  setIsDrawerOpen: (open: boolean) => void;
  registerBarcode: (barcode: string) => void;
  openRapidRegister: () => void;
}

function MainContent({
  activeMenu,
  setActiveMenu,
  refreshTrigger,
  setEditItemId,
  setIsDrawerOpen,
  registerBarcode,
  openRapidRegister,
}: MainContentProps) {
  switch (activeMenu) {
    case 'dashboard':
      return <Dashboard setActiveMenu={setActiveMenu} />;
    case 'pos':
      return <POS onRegisterBarcode={registerBarcode} />;
    case 'inventory':
    case 'opname':
    case 'stock-opname':
      return (
        <InventoryPage
          refreshTrigger={refreshTrigger}
          onEditItem={(itemId: string) => {
            setEditItemId(itemId);
            setIsDrawerOpen(true);
          }}
          onAddItem={() => {
            setEditItemId(null);
            setIsDrawerOpen(true);
          }}
          onRegisterBarcode={registerBarcode}
          onRapidRegister={openRapidRegister}
        />
      );
    case 'purchasing':
      return <PurchasingPage />;
    case 'customers':
      return <CustomerPromoPage />;
    case 'reports':
    case 'accounting':
    case 'laporan-penjualan':
    case 'laporan-item':
    case 'laporan-metode-pembayaran':
      return <ReportsAccountingPage />;
    case 'settings':
      return <Settings />;
    default:
      return (
        <div className="bg-card border border-line rounded-xl p-10 text-center h-full flex flex-col items-center justify-center gap-2">
          <Package size={28} className="text-dim" />
          <h3 className="text-base font-bold text-heading">Halaman tidak ditemukan</h3>
          <p className="text-xs text-dim">Pilih menu di sidebar untuk melanjutkan.</p>
        </div>
      );
  }
}


const MOBILE_TITLES: Record<string, string> = {
  dashboard: 'Ringkasan',
  inventory: 'Stok & Produk',
  opname: 'Stok & Produk',
  'stock-opname': 'Stok & Produk',
  purchasing: 'Pembelian',
  customers: 'Pelanggan & Promo',
  reports: 'Laporan',
  accounting: 'Laporan',
  'laporan-penjualan': 'Laporan',
  'laporan-item': 'Laporan',
  'laporan-metode-pembayaran': 'Laporan',
  settings: 'Pengaturan',
};

export default function App() {
  const [activeMenu, setActiveMenu] = useState('dashboard');
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  // Barcode handed to the "new product" form when registering straight from a scan.
  const [drawerBarcode, setDrawerBarcode] = useState<string | null>(null);
  // Rapid registration (scan -> assign to existing product, or create a new one).
  const [rapidOpen, setRapidOpen] = useState(false);
  const [rapidBarcode, setRapidBarcode] = useState<string | null>(null);
  const registerBarcode = useCallback((barcode: string) => {
    setRapidBarcode(barcode);
    setRapidOpen(true);
  }, []);
  const openRapidRegister = useCallback(() => {
    setRapidBarcode(null);
    setRapidOpen(true);
  }, []);
  const openFullFormWithBarcode = useCallback((barcode: string) => {
    setRapidOpen(false);
    setEditItemId(null);
    setDrawerBarcode(barcode);
    setIsDrawerOpen(true);
  }, []);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const { token, user, setAuth, clearAuth } = useAuthStore();
  const [isVerifying, setIsVerifying] = useState(true);
  const [hasCompletedSetup, setHasCompletedSetup] = useState<boolean | null>(null);
  const [showSetupWizard, setShowSetupWizard] = useState(false);

  const { zoom, zoomIn, zoomOut, reset } = useZoomStore();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem('kivo_sidebar_collapsed') === 'true';
  });

  const toggleSidebar = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('kivo_sidebar_collapsed', String(next));
      return next;
    });
  }, []);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Android Back from any other tab returns to the dashboard instead of closing the app.
  useMobileBack(isMobilePlatform() && !!token && activeMenu !== 'dashboard', () => setActiveMenu('dashboard'));
  const [isHostQrOpen, setIsHostQrOpen] = useState(false);
  const { updateInfo, isModalOpen, closeModal, checkUpdates } = useUpdaterStore();

  // Non-intrusive background check for updates on startup (desktop only)
  useEffect(() => {
    if (!isDesktopTauri()) return;
    const timer = setTimeout(() => {
      checkUpdates(false);
    }, 3500);
    return () => clearTimeout(timer);
  }, [checkUpdates]);

  // Auto-collapse sidebar on tablet screens (< 1024px)
  useEffect(() => {
    if (window.innerWidth < 1024) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  // Android app: until the user picks "connect to cashier PC" or "standalone", show the connect screen.
  const needsMobileSetup = isMobileTauri() && getMobileMode() === null;
  const [isSwitchHostOpen, setIsSwitchHostOpen] = useState(false);

  const handleLogout = async () => {
    if (isTauri() && !isRemoteClient()) {
      setSetting('active_host_token', '').catch(() => {});
    }
    if (token) await logoutUser(token);
    // Remote clients auto-join the host's session; remember an explicit logout so it sticks.
    try { localStorage.setItem(SKIP_AUTO_JOIN_KEY, '1'); } catch { /* storage unavailable */ }
    clearAuth();
  };

  // Check if first-run setup has been completed
  useEffect(() => {
    if (isRemoteClient() || needsMobileSetup) {
      // Remote client (browser, or the Android app joined to a cashier PC) uses the host's
      // data. Never block it with the desktop setup wizard!
      setHasCompletedSetup(true);
      return;
    }

    getSettings()
      .then((settings) => {
        const completed = settings.find(s => s.key === 'has_completed_setup')?.value === 'true';
        setHasCompletedSetup(completed);
      })
      .catch((err) => {
        console.warn('Could not check has_completed_setup:', err);
        setHasCompletedSetup(true);
      });
  }, []);
  
  useRealtimeSync();

  // Bump refreshTrigger whenever the pull-worker syncs cloud data locally
  useEffect(() => {
    const handler = () => setRefreshTrigger(p => p + 1);
    window.addEventListener('kivo:sync', handler);
    return () => window.removeEventListener('kivo:sync', handler);
  }, []);

  useEffect(() => {
    if (isMobilePlatform() || window.innerWidth < 1024) {
      (document.documentElement.style as any).zoom = '100%';
      return;
    }
    (document.documentElement.style as any).zoom = `${zoom}%`;
  }, [zoom]);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          zoomIn();
        } else if (e.key === '-') {
          e.preventDefault();
          zoomOut();
        } else if (e.key === '0') {
          e.preventDefault();
          reset();
        } else if (e.key.toLowerCase() === 'b') {
          e.preventDefault();
          toggleSidebar();
        }
      }

      // Global Shortcut for Cash Drawer (F2 or Alt + C) - Instant 0-lag kick with auto-resolved printer
      if (e.key === 'F2' || (e.altKey && e.key.toLowerCase() === 'c')) {
        e.preventDefault();
        kickCashDrawer().catch(err => {
          console.error('[Global Shortcut F2] Failed to kick cash drawer:', err);
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [zoomIn, zoomOut, reset, toggleSidebar]);

  useEffect(() => {
    const verifySession = async () => {
      // 1. If running on a client browser (mobile web/tablet) without an existing token:
      // Automatically query the host for its active session so it uses the SAME account!
      if (isRemoteClient() && !token && !skipAutoJoin()) {
        try {
          const hostUrl = getHostUrl();
          const res = await fetch(`${hostUrl}/api/lan/active_session`, {
            signal: AbortSignal.timeout(3500),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.success && data.token && data.user) {
              console.log('⚡ [Auto-Auth] Joined host session automatically:', data.user.name);
              setAuth(data.token, data.user);
              setIsVerifying(false);
              return;
            }
          }
        } catch (e) {
          console.warn('Could not auto-fetch host session:', e);
        }
      }

      if (!token) {
        setIsVerifying(false);
        return;
      }
      try {
        const validUser = await getCurrentUser(token);
        setAuth(token, validUser);
      } catch (e) {
        console.error("Session invalid:", e);
        clearAuth();
      } finally {
        setIsVerifying(false);
      }
    };
    verifySession();
  }, [token, setAuth, clearAuth]);

  useEffect(() => {
    if (!token) return;

    // --- Phase 9: Realtime Cloud -> Local Sync ---
    const setupRealtime = async () => {
      const { setStatus, setLastSyncTime } = useSyncStore.getState();

      setStatus('connecting');

      let workspaceId = '';
      let autoSync = false;
      try {
        const syncStatus = await getSyncStatus();
        workspaceId = syncStatus.workspace_id;
        autoSync = syncStatus.auto_sync;
      } catch (err) {
        console.error("Failed to load sync status:", err);
      }

      if (!workspaceId) {
        console.log('⚠️ No active workspace connected. Realtime sync bypassed.');
        setStatus('disconnected');
        return;
      }

      if (!autoSync) {
        console.log('⏸️ Automatic sync disabled in settings. Realtime sync bypassed.');
        setStatus('disconnected');
        return;
      }

      console.log('📡 Subscribing to Supabase Realtime for workspace:', workspaceId);

      // Use a unique channel name each time to avoid getting a cached, already-subscribed channel from Supabase
      const channelName = `kivo-sync-${workspaceId}-${Date.now()}`;
      let channel = supabase.channel(channelName);

      const tablesToSync = [
        'sales', 'stock_ledger', 'categories', 'brands', 'items', 'item_units', 'item_prices',
        'customers', 'suppliers', 'promos', 'users', 'role_default_permissions'
      ];

      tablesToSync.forEach(table => {
        channel = channel.on(
          'postgres_changes',
          { event: '*', schema: 'public', table, filter: `workspace_id=eq.${workspaceId}` },
          (payload) => {
            console.log(`🔄 Cloud update received (${table}):`, payload);
            invoke('receive_cloud_sync', { tableName: table, payload: payload.new })
              .then(() => {
                setRefreshTrigger(p => p + 1);
                setLastSyncTime(new Date());
              })
              .catch(console.error);
          }
        );
      });

      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('✅ Connected to Supabase Realtime');
          setStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setStatus('error');
        }
      });

      return () => {
        supabase.removeChannel(channel);
      };
    };

    let activeCleanup: (() => void) | undefined;

    const runSetup = async () => {
      if (activeCleanup) {
        activeCleanup();
        activeCleanup = undefined;
      }
      const cleanup = await setupRealtime();
      if (cleanup) activeCleanup = cleanup;
    };

    runSetup();

    const handleAutoSyncChange = () => {
      runSetup();
    };

    window.addEventListener('kivo:auto_sync_changed', handleAutoSyncChange);

    return () => {
      window.removeEventListener('kivo:auto_sync_changed', handleAutoSyncChange);
      if (activeCleanup) activeCleanup();
    };
  }, [token]);

  if (needsMobileSetup) {
    return <MobileConnect variant="first-run" />;
  }

  if (isSwitchHostOpen) {
    return <MobileConnect variant="switch" onCancel={() => setIsSwitchHostOpen(false)} />;
  }

  if (isVerifying || hasCompletedSetup === null) {
    return (
      <div className="flex h-[100dvh] w-full items-center justify-center bg-background">
        <Loader2 className="animate-spin text-primary" size={28} />
      </div>
    );
  }

  if ((isTauri() && !isRemoteClient() && hasCompletedSetup === false) || showSetupWizard) {
    return (
      <SetupWizard
        onComplete={() => {
          setHasCompletedSetup(true);
          setShowSetupWizard(false);
        }}
        onCancel={hasCompletedSetup ? () => setShowSetupWizard(false) : undefined}
      />
    );
  }

  if (!token || !user) {
    return (
      <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background">
        <TitleBar />
        <div className="flex-1 flex flex-col overflow-y-auto overflow-x-hidden relative">
          <LoginPage
            onOpenSetupWizard={isRemoteClient() ? undefined : () => setShowSetupWizard(true)}
            onChangeHost={isMobileTauri() ? () => setIsSwitchHostOpen(true) : undefined}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[100dvh] w-full overflow-hidden bg-background">
      {!isMobilePlatform() && <ContextMenu />}
      {/* Unified Desktop TitleBar + Topbar (hidden on mobile < 768px) */}
      <Topbar
        activeMenu={activeMenu}
        setActiveMenu={setActiveMenu}
        onOpenAIChat={() => setIsAIChatOpen(true)}
        onOpenHostQr={() => setIsHostQrOpen(true)}
        isSidebarCollapsed={isSidebarCollapsed}
        onToggleSidebar={toggleSidebar}
      />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <Sidebar
          activeMenu={activeMenu}
          setActiveMenu={setActiveMenu}
          onOpenAIChat={() => setIsAIChatOpen(true)}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={toggleSidebar}
        />
        <main className="flex-1 flex flex-col h-full min-h-0 min-w-0 relative overflow-hidden bg-background">
          {/* Phone-only top bar (< 768px). The cashier screen has its own header, so it is skipped there. */}
          {activeMenu !== 'pos' && (
            <MobileAppBar
              title={MOBILE_TITLES[activeMenu] ?? 'Kivo'}
              onOpenMenu={() => setIsMobileMenuOpen(true)}
              onOpenAIChat={() => setIsAIChatOpen(true)}
              onChangeHost={isMobileTauri() ? () => setIsSwitchHostOpen(true) : undefined}
            />
          )}
          <div className={`flex-1 min-h-0 min-w-0 overflow-hidden relative flex flex-col ${activeMenu === 'pos' ? 'p-0' : 'p-2.5 sm:p-3.5 md:p-4 lg:p-5'}`}>
            <MainContent
              activeMenu={activeMenu}
              setActiveMenu={setActiveMenu}
              refreshTrigger={refreshTrigger}
              setEditItemId={setEditItemId}
              setIsDrawerOpen={setIsDrawerOpen}
              registerBarcode={registerBarcode}
              openRapidRegister={openRapidRegister}
            />
          </div>

          {/* Mobile Bottom Navigation Bar (< 768px) in normal flex flow so it never covers content */}
          <MobileNav
            activeMenu={activeMenu}
            setActiveMenu={setActiveMenu}
            onOpenMenuDrawer={() => setIsMobileMenuOpen(true)}
          />

          <ItemDrawer
            isOpen={isDrawerOpen}
            onClose={() => {
              setIsDrawerOpen(false);
              setEditItemId(null);
              setDrawerBarcode(null);
            }}
            onItemAdded={() => setRefreshTrigger(prev => prev + 1)}
            editItemId={editItemId}
            initialBarcode={drawerBarcode}
          />
          <RapidRegisterModal
            isOpen={rapidOpen}
            onClose={() => {
              setRapidOpen(false);
              setRapidBarcode(null);
            }}
            initialBarcode={rapidBarcode}
            onChanged={() => setRefreshTrigger(prev => prev + 1)}
            onOpenFullForm={openFullFormWithBarcode}
          />
          <AIChat
            isOpen={isAIChatOpen}
            onClose={() => setIsAIChatOpen(false)}
            branchId={user.branch_id || 'branch_001'}
          />

          <MobileMenuDrawer
            isOpen={isMobileMenuOpen}
            onClose={() => setIsMobileMenuOpen(false)}
            activeMenu={activeMenu}
            setActiveMenu={setActiveMenu}
            onOpenHostQr={() => setIsHostQrOpen(true)}
            onOpenAIChat={() => setIsAIChatOpen(true)}
            onChangeHost={isMobileTauri() ? () => setIsSwitchHostOpen(true) : undefined}
            onLogout={handleLogout}
          />

          <HostQrModal
            isOpen={isHostQrOpen}
            onClose={() => setIsHostQrOpen(false)}
          />

          <UpdateModal
            isOpen={isModalOpen}
            onClose={closeModal}
            updateInfo={updateInfo}
          />
        </main>
      </div>
    </div>
  );
}