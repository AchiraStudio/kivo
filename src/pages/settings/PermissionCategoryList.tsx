import { useMemo } from 'react';
import {
  ShoppingCart, Package, Truck, Users, FileText,
  Settings as SettingsIcon, Sliders, Search
} from 'lucide-react';
import { PermissionDef } from '../../lib/api';

interface PermissionCategoryListProps {
  definitions: PermissionDef[];
  selectedPerms: Set<string>;
  searchQuery: string;
  onTogglePerm: (key: string) => void;
  onToggleCategory: (catName: string, enable: boolean) => void;
  disabled?: boolean;
}

const CATEGORY_ICONS: Record<string, any> = {
  'Penjualan (POS)': ShoppingCart,
  'Inventaris & Produk': Package,
  'Pembelian & Pemasok': Truck,
  'Pelanggan & Promo': Users,
  'Laporan & Keuangan': FileText,
  'Pengaturan & Sistem': SettingsIcon,
};

export default function PermissionCategoryList({
  definitions,
  selectedPerms,
  searchQuery,
  onTogglePerm,
  onToggleCategory,
  disabled = false,
}: PermissionCategoryListProps) {
  const categories = useMemo(() => {
    const groups: Record<string, PermissionDef[]> = {};
    const q = searchQuery.toLowerCase().trim();

    for (const def of definitions) {
      if (!groups[def.category]) {
        groups[def.category] = [];
      }
      if (
        !q ||
        def.name.toLowerCase().includes(q) ||
        def.key.toLowerCase().includes(q) ||
        def.description.toLowerCase().includes(q)
      ) {
        groups[def.category].push(def);
      }
    }
    return groups;
  }, [definitions, searchQuery]);

  const visibleEntries = Object.entries(categories).filter(([, items]) => items.length > 0);

  if (visibleEntries.length === 0) {
    return (
      <div className="py-10 px-4 text-center rounded-xl border border-line bg-muted/40">
        <Search size={20} className="mx-auto text-dim mb-2" />
        <p className="text-xs font-semibold text-heading">Tidak ada izin yang cocok</p>
        <p className="text-xs text-dim mt-0.5">Coba kata kunci lain atau hapus pencarian.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {visibleEntries.map(([catName, items]) => {
        const Icon = CATEGORY_ICONS[catName] || Sliders;
        const activeCount = items.filter(i => selectedPerms.has(i.key)).length;
        const allActive = activeCount === items.length;

        return (
          <div
            key={catName}
            className="bg-card rounded-xl border border-line overflow-hidden"
          >
            {/* Category Header */}
            <div className="px-4 py-3 bg-muted/50 border-b border-line flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-7 h-7 rounded-lg bg-muted border border-line text-heading flex items-center justify-center shrink-0">
                  <Icon size={14} strokeWidth={1.75} />
                </div>
                <h3 className="text-xs font-bold text-heading truncate">
                  {catName}
                </h3>
                <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md tnum shrink-0 ${
                  allActive
                    ? 'bg-primary-soft text-primary'
                    : activeCount > 0
                    ? 'bg-warning-soft text-warning'
                    : 'bg-muted text-dim'
                }`}>
                  {activeCount}/{items.length}
                </span>
              </div>

              {!disabled && (
                <button
                  type="button"
                  onClick={() => onToggleCategory(catName, !allActive)}
                  className="text-xs font-semibold text-dim hover:text-heading px-2 py-1 rounded-md hover:bg-muted transition-colors cursor-pointer shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  {allActive ? 'Matikan semua' : 'Pilih semua'}
                </button>
              )}
            </div>

            {/* Permission Items */}
            <div className="divide-y divide-line">
              {items.map((item) => {
                const isChecked = selectedPerms.has(item.key);
                return (
                  <label
                    key={item.key}
                    className={`px-4 py-3 flex items-start justify-between gap-4 transition-colors ${
                      disabled
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:bg-muted/40 cursor-pointer'
                    }`}
                  >
                    <div className="flex-1 min-w-0 pr-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-heading">
                          {item.name}
                        </span>
                        <code className="text-[10px] font-mono text-dim bg-muted px-1.5 py-0.5 rounded-md">
                          {item.key}
                        </code>
                      </div>
                      {item.description && (
                        <p className="text-xs text-dim mt-0.5 leading-snug">
                          {item.description}
                        </p>
                      )}
                    </div>

                    <div className="pt-0.5 shrink-0">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        disabled={disabled}
                        onChange={() => onTogglePerm(item.key)}
                        className="w-4 h-4 rounded text-primary focus-visible:ring-2 focus-visible:ring-primary accent-primary cursor-pointer disabled:cursor-not-allowed"
                      />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
