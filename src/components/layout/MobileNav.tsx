import { ShoppingCart, LayoutDashboard, Package, FileText, Menu } from 'lucide-react';
import { usePermissions } from '../../lib/permissions';
import { useCartBadgeStore } from '../../store/CartBadgeStore';

interface MobileNavProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onOpenMenuDrawer: () => void;
}

const REPORT_MENUS = new Set(['reports', 'accounting', 'laporan-penjualan', 'laporan-item', 'laporan-metode-pembayaran']);
const INVENTORY_MENUS = new Set(['inventory', 'opname', 'stock-opname']);

/**
 * Bottom tab bar. The cashier tab sits in the middle as the primary action because
 * selling is what people open the phone app for.
 */
export default function MobileNav({ activeMenu, setActiveMenu, onOpenMenuDrawer }: MobileNavProps) {
  const { can } = usePermissions();
  const cartCount = useCartBadgeStore((s) => s.count);

  const isActive = (id: string) =>
    id === 'reports' ? REPORT_MENUS.has(activeMenu) : id === 'inventory' ? INVENTORY_MENUS.has(activeMenu) : activeMenu === id;

  const tabs = [
    { id: 'dashboard', label: 'Ringkasan', icon: LayoutDashboard, show: true },
    { id: 'inventory', label: 'Stok', icon: Package, show: can('items.view') || can('inventory.view') },
    { id: 'pos', label: 'Kasir', icon: ShoppingCart, show: can('sales.create'), primary: true },
    { id: 'reports', label: 'Laporan', icon: FileText, show: can('reports.view') || can('accounting.manage') },
  ].filter((t) => t.show);

  const tabClass = (active: boolean) =>
    `relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] rounded-xl cursor-pointer select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      active ? 'text-primary' : 'text-dim active:text-heading'
    }`;

  return (
    <nav
      aria-label="Navigasi utama"
      className="md:hidden shrink-0 w-full bg-card border-t border-line pb-[env(safe-area-inset-bottom)] z-30"
    >
      <div className="flex items-stretch px-1.5 pt-1 pb-1">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.id);

          if (tab.primary) {
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveMenu(tab.id)}
                aria-current={active ? 'page' : undefined}
                aria-label={cartCount > 0 ? `${tab.label}, ${cartCount} barang di keranjang` : tab.label}
                className="relative flex-1 min-h-[56px] flex flex-col items-center justify-end cursor-pointer select-none focus-visible:outline-none"
              >
                <span
                  className={`absolute -top-5 w-14 h-14 rounded-full flex items-center justify-center text-white border-4 border-card shadow-lg shadow-primary/30 transition-transform active:scale-95 ${
                    active ? 'bg-primary-hover' : 'bg-primary'
                  }`}
                >
                  <Icon size={24} strokeWidth={2} />
                  {cartCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-warning text-black text-[11px] font-extrabold flex items-center justify-center tnum border-2 border-card">
                      {cartCount > 99 ? '99+' : cartCount}
                    </span>
                  )}
                </span>
                <span className={`text-[11px] font-bold pb-1 ${active ? 'text-primary' : 'text-dim'}`}>{tab.label}</span>
              </button>
            );
          }

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveMenu(tab.id)}
              aria-current={active ? 'page' : undefined}
              className={tabClass(active)}
            >
              <span className={`h-7 w-14 rounded-full flex items-center justify-center transition-colors ${active ? 'bg-primary-soft' : ''}`}>
                <Icon size={20} strokeWidth={active ? 2.3 : 1.8} />
              </span>
              <span className={`text-[11px] ${active ? 'font-bold' : 'font-semibold'}`}>{tab.label}</span>
            </button>
          );
        })}

        <button type="button" onClick={onOpenMenuDrawer} className={tabClass(false)}>
          <span className="h-7 w-14 rounded-full flex items-center justify-center">
            <Menu size={20} strokeWidth={1.8} />
          </span>
          <span className="text-[11px] font-semibold">Menu</span>
        </button>
      </div>
    </nav>
  );
}
