import { ShoppingCart, LayoutDashboard, Package, FileText, Menu } from 'lucide-react';
import { usePermissions } from '../../lib/permissions';

interface MobileNavProps {
  activeMenu: string;
  setActiveMenu: (menu: string) => void;
  onOpenMenuDrawer: () => void;
  cartCount?: number;
}

export default function MobileNav({
  activeMenu,
  setActiveMenu,
  onOpenMenuDrawer,
  cartCount = 0,
}: MobileNavProps) {
  const { can } = usePermissions();

  const NAV_ITEMS = [
    {
      id: 'pos',
      label: 'Kasir',
      icon: ShoppingCart,
      show: can('sales.create'),
      badge: cartCount > 0 ? cartCount : null,
    },
    {
      id: 'dashboard',
      label: 'Ringkasan',
      icon: LayoutDashboard,
      show: true,
    },
    {
      id: 'inventory',
      label: 'Inventaris',
      icon: Package,
      show: can('items.view') || can('inventory.view'),
    },
    {
      id: 'reports',
      label: 'Laporan',
      icon: FileText,
      show: can('reports.view') || can('accounting.manage'),
    },
  ];

  return (
    <nav
      aria-label="Navigasi mobile"
      className="md:hidden shrink-0 w-full bg-card border-t border-line pb-[env(safe-area-inset-bottom)] select-none z-30"
    >
      <div className="flex items-center justify-around px-1 py-1">
        {NAV_ITEMS.filter(item => item.show).map((item) => {
          const Icon = item.icon;
          const isActive = activeMenu === item.id;

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveMenu(item.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 px-1 rounded-lg transition-colors relative cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                isActive
                  ? 'text-primary font-semibold'
                  : 'text-dim hover:text-heading font-medium'
              }`}
            >
              <div className="relative flex items-center justify-center">
                <Icon size={18} strokeWidth={isActive ? 2.2 : 1.75} />
                {item.badge ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center tnum">
                    {item.badge}
                  </span>
                ) : null}
              </div>
              <span className="text-[10px] mt-0.5 truncate max-w-[64px]">
                {item.label}
              </span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={onOpenMenuDrawer}
          className="flex flex-col items-center justify-center flex-1 min-h-[44px] py-1 px-1 rounded-lg text-dim hover:text-heading font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
          <Menu size={18} strokeWidth={1.75} />
          <span className="text-[10px] mt-0.5">Menu</span>
        </button>
      </div>
    </nav>
  );
}
