import React, { useState, useMemo } from 'react';
import {
  ShoppingCart,
  TrendingUp,
  CreditCard,
  Package,
  AlertTriangle,
  FileText,
  Truck,
  Users,
  ChevronRight,
  LayoutGrid,
  ArrowUpRight,
} from 'lucide-react';
import LaporanPenjualan from './LaporanPenjualan';
import LaporanItemTerlaris from './LaporanItemTerlaris';
import LaporanMetodePembayaran from './LaporanMetodePembayaran';
import LaporanStok from './LaporanStok';
import LaporanKadaluarsa from './LaporanKadaluarsa';
import LaporanHutang from './LaporanHutang';
import LaporanPembelian from './LaporanPembelian';
import LaporanPelanggan from './LaporanPelanggan';
import TabBar, { TabItem } from '../../components/ui/TabBar';
import Button from '../../components/ui/Button';

interface ReportCardItem {
  id: string;
  title: string;
  desc: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
}

interface ReportCategory {
  id: CategoryTab;
  categoryTitle: string;
  items: ReportCardItem[];
}

type CategoryTab = 'all' | 'penjualan' | 'inventaris' | 'pengadaan' | 'pelanggan';

const REPORT_TABS: TabItem<CategoryTab>[] = [
  { id: 'all', label: 'Semua', icon: LayoutGrid },
  { id: 'penjualan', label: 'Penjualan', icon: ShoppingCart },
  { id: 'inventaris', label: 'Inventori', icon: Package },
  { id: 'pengadaan', label: 'Pengadaan', icon: Truck },
  { id: 'pelanggan', label: 'Pelanggan', icon: Users },
];

const REPORT_CATEGORIES: ReportCategory[] = [
  {
    id: 'penjualan',
    categoryTitle: 'Penjualan & Kasir',
    items: [
      {
        id: 'penjualan',
        title: 'Laporan Penjualan',
        desc: 'Rekap nota, rincian item, harian, per kasir, dan pelanggan.',
        icon: ShoppingCart,
      },
      {
        id: 'item-terlaris',
        title: 'Item Terlaris & Margin',
        desc: 'Peringkat produk berdasarkan omset dan margin kotor.',
        icon: TrendingUp,
      },
      {
        id: 'metode-bayar',
        title: 'Metode Pembayaran',
        desc: 'Distribusi Tunai, QRIS, transfer bank, dan kartu.',
        icon: CreditCard,
      },
    ],
  },
  {
    id: 'inventaris',
    categoryTitle: 'Inventori & Stok',
    items: [
      {
        id: 'stok',
        title: 'Valuasi Stok',
        desc: 'Nilai persediaan fisik berdasarkan HPP rata-rata berjalan.',
        icon: Package,
      },
      {
        id: 'kadaluarsa',
        title: 'Hampir Kadaluarsa',
        desc: 'Batch produk yang mendekati tanggal expired.',
        icon: AlertTriangle,
      },
    ],
  },
  {
    id: 'pengadaan',
    categoryTitle: 'Pengadaan & Hutang',
    items: [
      {
        id: 'pembelian',
        title: 'Rekap Pembelian',
        desc: 'Total pengadaan dan faktur pembelian per pemasok.',
        icon: Truck,
      },
      {
        id: 'hutang',
        title: 'Hutang Dagang (AP)',
        desc: 'Tagihan pembelian belum lunas dan sisa saldo pemasok.',
        icon: FileText,
      },
    ],
  },
  {
    id: 'pelanggan',
    categoryTitle: 'Pelanggan',
    items: [
      {
        id: 'pelanggan',
        title: 'Belanja Pelanggan',
        desc: 'Peringkat pelanggan berdasarkan transaksi dan total belanja.',
        icon: Users,
      },
    ],
  },
];

const COMPONENTS: Record<string, React.FC<{ onBack: () => void }>> = {
  penjualan: LaporanPenjualan,
  'item-terlaris': LaporanItemTerlaris,
  'metode-bayar': LaporanMetodePembayaran,
  stok: LaporanStok,
  kadaluarsa: LaporanKadaluarsa,
  hutang: LaporanHutang,
  pembelian: LaporanPembelian,
  pelanggan: LaporanPelanggan,
};

export default function Reports() {
  const [activeReport, setActiveReport] = useState<string | null>(null);
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<CategoryTab>('all');

  const visibleCategories = useMemo(() => {
    if (selectedCategoryTab === 'all') return REPORT_CATEGORIES;
    return REPORT_CATEGORIES.filter((c) => c.id === selectedCategoryTab);
  }, [selectedCategoryTab]);

  if (activeReport) {
    if (activeReport === 'metode-bayar') {
      return <LaporanPenjualan onBack={() => setActiveReport(null)} initialSubtype="payment_methods" />;
    }
    const Component = COMPONENTS[activeReport];
    return Component ? <Component onBack={() => setActiveReport(null)} /> : null;
  }

  return (
    <div className="flex flex-col gap-5 animate-fade-in h-full overflow-y-auto custom-scrollbar pr-1 pb-6">
      <TabBar
        tabs={REPORT_TABS}
        activeTab={selectedCategoryTab}
        onTabChange={setSelectedCategoryTab}
        rightAction={
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={() => setActiveReport('penjualan')}
          >
            <ShoppingCart size={14} strokeWidth={1.75} />
            Laporan Penjualan
            <ArrowUpRight size={14} strokeWidth={1.75} />
          </Button>
        }
      />

      <div className="space-y-5">
        {visibleCategories.map((cat) => (
          <section key={cat.id} className="space-y-2.5">
            <h2 className="text-sm font-bold text-heading">{cat.categoryTitle}</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {cat.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveReport(item.id)}
                    className="flex items-start gap-3.5 text-left p-4 rounded-xl border border-line bg-card hover:border-line-strong hover:bg-muted/30 transition-colors group cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <div className="w-9 h-9 rounded-lg bg-muted text-heading group-hover:bg-primary-soft group-hover:text-primary flex items-center justify-center shrink-0 transition-colors">
                      <Icon size={18} strokeWidth={1.75} />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="text-sm font-bold text-heading group-hover:text-primary transition-colors truncate">
                          {item.title}
                        </h3>
                        <ChevronRight
                          size={15}
                          strokeWidth={1.75}
                          className="text-dim group-hover:text-primary shrink-0 transition-colors"
                        />
                      </div>
                      <p className="text-xs text-dim mt-1 leading-relaxed line-clamp-2">
                        {item.desc}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
