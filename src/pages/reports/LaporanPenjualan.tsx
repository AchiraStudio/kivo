import { useState, useEffect, useMemo } from 'react';
import {
  ArrowLeft,
  Loader2,
  TrendingUp,
  FileText,
  Filter,
  Printer,
  Download,
  Eye,
  Search,
  RefreshCw,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp,
  X,
  RotateCcw,
  List,
  Calendar,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  getSalesRecapReport,
  getDetailedSalesLines,
  getSalesByCashierSummary,
  getDailySalesRecap,
  getTopSellingItems,
  getSalesByPaymentMethod,
  getCustomers,
  getUsers,
  getCategories,
  SalesRecapReportRow,
  SalesLineReportRow,
  CashierSalesReportRow,
  DailySalesRecapRow,
  PaymentMethodRow,
  Customer,
  Category,
  TopItemRow,
} from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import SaleDetailModal from '../../components/pos/SaleDetailModal';
import PrintReportModal from '../../components/reports/PrintReportModal';
import { useAuthStore } from '../../store/AuthStore';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';
import TabBar, { TabItem } from '../../components/ui/TabBar';

interface Props {
  onBack: () => void;
  initialSubtype?: ReportSubtype;
}

type ReportSubtype =
  | 'recap'
  | 'detailed'
  | 'daily'
  | 'payment_methods'
  | 'customer'
  | 'cashier'
  | 'product_margin';

const METHOD_CONFIG: Record<
  string,
  {
    label: string;
    icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
    color: string;
  }
> = {
  cash: { label: 'Tunai', icon: Banknote, color: 'bg-success' },
  transfer: { label: 'Transfer Bank', icon: ArrowRightLeft, color: 'bg-info' },
  debit: { label: 'Kartu Debit / EDC', icon: CreditCard, color: 'bg-primary' },
  credit: { label: 'Kartu Kredit', icon: CreditCard, color: 'bg-primary' },
  qris: { label: 'QRIS / E-Wallet', icon: Smartphone, color: 'bg-warning' },
  card: { label: 'Kartu EDC', icon: CreditCard, color: 'bg-primary' },
  tempo: { label: 'Tempo / Piutang', icon: FileText, color: 'bg-danger' },
};

const SUB_REPORT_TABS: TabItem<ReportSubtype>[] = [
  { id: 'recap', label: 'Rekap Faktur', icon: FileText },
  { id: 'detailed', label: 'Rincian Item', icon: List },
  { id: 'payment_methods', label: 'Metode Bayar', icon: CreditCard },
  { id: 'daily', label: 'Harian', icon: Calendar },
  { id: 'customer', label: 'Pelanggan', icon: Users },
  { id: 'cashier', label: 'Kasir', icon: UserCheck },
  { id: 'product_margin', label: 'Margin Produk', icon: TrendingUp },
];

export default function LaporanPenjualan({ onBack, initialSubtype = 'recap' }: Props) {
  const { user } = useAuthStore();
  const branchId = user?.branch_id || 'branch_001';

  const [activeSubtype, setActiveSubtype] = useState<ReportSubtype>(initialSubtype);

  const [presetPeriod, setPresetPeriod] = useState<string>('month');
  const [dateFrom, setDateFrom] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [dateTo, setDateTo] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [txFrom, setTxFrom] = useState<string>('');
  const [txTo, setTxTo] = useState<string>('');
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [selectedPriceType, setSelectedPriceType] = useState<string>('all');

  const [searchTableQuery, setSearchTableQuery] = useState<string>('');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [usersList, setUsersList] = useState<any[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recapData, setRecapData] = useState<SalesRecapReportRow[]>([]);
  const [detailedData, setDetailedData] = useState<SalesLineReportRow[]>([]);
  const [dailyData, setDailyData] = useState<DailySalesRecapRow[]>([]);
  const [paymentMethodData, setPaymentMethodData] = useState<PaymentMethodRow[]>([]);
  const [cashierData, setCashierData] = useState<CashierSalesReportRow[]>([]);
  const [productMarginData, setProductMarginData] = useState<TopItemRow[]>([]);

  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);

  useEffect(() => {
    getCustomers('', '', true).then(setCustomers).catch(console.error);
    getUsers().then(setUsersList).catch(console.error);
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const applyPreset = (preset: string) => {
    setPresetPeriod(preset);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');

    if (preset === 'today') {
      const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      setDateFrom(todayStr);
      setDateTo(todayStr);
    } else if (preset === 'yesterday') {
      const y = new Date();
      y.setDate(y.getDate() - 1);
      const yStr = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
      setDateFrom(yStr);
      setDateTo(yStr);
    } else if (preset === '7days') {
      const last7 = new Date();
      last7.setDate(last7.getDate() - 6);
      setDateFrom(`${last7.getFullYear()}-${pad(last7.getMonth() + 1)}-${pad(last7.getDate())}`);
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (preset === '30days') {
      const last30 = new Date();
      last30.setDate(last30.getDate() - 29);
      setDateFrom(`${last30.getFullYear()}-${pad(last30.getMonth() + 1)}-${pad(last30.getDate())}`);
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (preset === 'month') {
      setDateFrom(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`);
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (preset === 'last_month') {
      const firstDayLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      setDateFrom(`${firstDayLastMonth.getFullYear()}-${pad(firstDayLastMonth.getMonth() + 1)}-01`);
      setDateTo(
        `${lastDayLastMonth.getFullYear()}-${pad(lastDayLastMonth.getMonth() + 1)}-${pad(lastDayLastMonth.getDate())}`
      );
    } else if (preset === 'this_year') {
      setDateFrom(`${now.getFullYear()}-01-01`);
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    } else if (preset === 'all') {
      setDateFrom('2020-01-01');
      setDateTo(`${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`);
    }
  };

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (selectedCustomerId) count++;
    if (selectedUserId) count++;
    if (selectedPaymentMethod !== 'all') count++;
    if (selectedCategoryId) count++;
    if (selectedPriceType !== 'all') count++;
    if (txFrom.trim()) count++;
    if (txTo.trim()) count++;
    return count;
  }, [
    selectedCustomerId,
    selectedUserId,
    selectedPaymentMethod,
    selectedCategoryId,
    selectedPriceType,
    txFrom,
    txTo,
  ]);

  const resetFilters = () => {
    setSelectedCustomerId('');
    setSelectedUserId('');
    setSelectedPaymentMethod('all');
    setSelectedCategoryId('');
    setSelectedPriceType('all');
    setTxFrom('');
    setTxTo('');
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    const filter = {
      branch_id: branchId,
      date_from: dateFrom ? `${dateFrom} 00:00:00` : undefined,
      date_to: dateTo ? `${dateTo} 23:59:59` : undefined,
      tx_from: txFrom.trim() || undefined,
      tx_to: txTo.trim() || undefined,
      customer_id: selectedCustomerId || undefined,
      user_id: selectedUserId || undefined,
      payment_method: selectedPaymentMethod !== 'all' ? selectedPaymentMethod : undefined,
      category_id: selectedCategoryId || undefined,
      price_type: selectedPriceType !== 'all' ? selectedPriceType : undefined,
    };

    try {
      getSalesByPaymentMethod(branchId, dateFrom, dateTo)
        .then(setPaymentMethodData)
        .catch(console.error);

      if (activeSubtype === 'detailed') {
        const data = await getDetailedSalesLines(filter);
        setDetailedData(data);
      } else {
        const recapPromise = getSalesRecapReport(filter).then(setRecapData);
        if (activeSubtype === 'daily') {
          const data = await getDailySalesRecap(filter);
          setDailyData(data);
        } else if (activeSubtype === 'cashier') {
          const data = await getSalesByCashierSummary(filter);
          setCashierData(data);
        } else if (activeSubtype === 'product_margin') {
          const data = await getTopSellingItems(branchId, dateFrom, dateTo, 100);
          setProductMarginData(data);
        }
        await recapPromise;
      }
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data laporan penjualan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [
    activeSubtype,
    dateFrom,
    dateTo,
    selectedCustomerId,
    selectedUserId,
    selectedPaymentMethod,
    selectedCategoryId,
    selectedPriceType,
  ]);

  useEffect(() => {
    const handleSync = () => fetchReportData();
    window.addEventListener('kivo:sync', handleSync);
    return () => window.removeEventListener('kivo:sync', handleSync);
  }, [
    activeSubtype,
    dateFrom,
    dateTo,
    selectedCustomerId,
    selectedUserId,
    selectedPaymentMethod,
    selectedCategoryId,
    selectedPriceType,
  ]);

  const kpi = useMemo(() => {
    if (activeSubtype === 'detailed') {
      const revenue = detailedData.reduce((acc, row) => acc + row.subtotal, 0);
      const discount = detailedData.reduce((acc, row) => acc + row.line_discount, 0);
      const cogs = detailedData.reduce((acc, row) => acc + row.line_cogs, 0);
      const profit = revenue - cogs;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { revenue, discount, cogs, profit, margin, count: detailedData.length };
    } else {
      const revenue = recapData.reduce((acc, row) => acc + row.grand_total, 0);
      const discount = recapData.reduce((acc, row) => acc + row.discount_amount, 0);
      const cogs = recapData.reduce((acc, row) => acc + row.total_cogs, 0);
      const profit = revenue - cogs;
      const margin = revenue > 0 ? (profit / revenue) * 100 : 0;
      return { revenue, discount, cogs, profit, margin, count: recapData.length };
    }
  }, [activeSubtype, recapData, detailedData]);

  const customerGrouped = useMemo(() => {
    const map = new Map<
      string,
      { name: string; tier: string; txCount: number; totalSpent: number; totalProfit: number }
    >();
    for (const r of recapData) {
      const key = r.customer_name;
      if (!map.has(key)) {
        map.set(key, {
          name: r.customer_name,
          tier: r.customer_tier,
          txCount: 0,
          totalSpent: 0,
          totalProfit: 0,
        });
      }
      const entry = map.get(key)!;
      entry.txCount += 1;
      entry.totalSpent += r.grand_total;
      entry.totalProfit += r.gross_profit;
    }
    return Array.from(map.values()).sort((a, b) => b.totalSpent - a.totalSpent);
  }, [recapData]);

  const totalPaymentMethodAmount = useMemo(
    () => paymentMethodData.reduce((acc, curr) => acc + curr.total_amount, 0),
    [paymentMethodData]
  );

  const handleExportCsv = () => {
    const filename = `Laporan_Penjualan_${activeSubtype}_${dateFrom}_sd_${dateTo}.csv`;
    if (activeSubtype === 'recap') {
      const headers = [
        '#',
        'No Transaksi',
        'Waktu',
        'Pelanggan',
        'Kasir',
        'Total Jual',
        'Diskon',
        'HPP',
        'Laba Kotor',
        'Margin (%)',
        'Cara Bayar',
      ];
      const rows = recapData.map((r, i) => [
        i + 1,
        r.transaction_no,
        r.created_at,
        r.customer_name,
        r.cashier_name,
        r.grand_total,
        r.discount_amount,
        r.total_cogs,
        r.gross_profit,
        r.gross_margin,
        r.payment_methods,
      ]);
      downloadCsv(filename, headers, rows);
    } else if (activeSubtype === 'detailed') {
      const headers = [
        '#',
        'No Transaksi',
        'Waktu',
        'Pelanggan',
        'Kasir',
        'SKU',
        'Nama Barang',
        'Kategori',
        'Qty',
        'Satuan',
        'Harga',
        'Diskon',
        'Subtotal',
        'HPP',
        'Laba Baris',
        'Cara Bayar',
      ];
      const rows = detailedData.map((r, i) => [
        i + 1,
        r.transaction_no,
        r.created_at,
        r.customer_name,
        r.cashier_name,
        r.sku,
        r.item_name,
        r.category_name,
        r.qty,
        r.unit_name,
        r.price,
        r.line_discount,
        r.subtotal,
        r.line_cogs,
        r.line_profit,
        r.payment_methods,
      ]);
      downloadCsv(filename, headers, rows);
    } else if (activeSubtype === 'daily') {
      const headers = [
        'Tanggal',
        'Jumlah Transaksi',
        'Total Tunai',
        'Total Non-Tunai',
        'Total Omset',
        'Diskon',
        'HPP',
        'Laba Kotor',
        'Margin (%)',
      ];
      const rows = dailyData.map((r) => [
        r.date_label,
        r.transaction_count,
        r.total_cash,
        r.total_non_cash,
        r.total_revenue,
        r.total_discount,
        r.total_cogs,
        r.gross_profit,
        r.gross_margin,
      ]);
      downloadCsv(filename, headers, rows);
    } else if (activeSubtype === 'cashier') {
      const headers = [
        'Kasir / Staff',
        'Role',
        'Jumlah Transaksi',
        'Total Tunai',
        'Total Non-Tunai',
        'Total Penjualan',
        'Total Laba',
      ];
      const rows = cashierData.map((r) => [
        r.cashier_name,
        r.role,
        r.transaction_count,
        r.total_cash,
        r.total_non_cash,
        r.total_revenue,
        r.gross_profit,
      ]);
      downloadCsv(filename, headers, rows);
    } else if (activeSubtype === 'payment_methods') {
      const headers = [
        '#',
        'Metode Pembayaran',
        'Jumlah Transaksi',
        'Total Nominal (Rp)',
        'Rata-rata per Transaksi (Rp)',
        'Kontribusi (%)',
      ];
      const rows = paymentMethodData.map((r, i) => {
        const m = METHOD_CONFIG[r.method.toLowerCase()]?.label || r.method.toUpperCase();
        const pct =
          totalPaymentMethodAmount > 0
            ? ((r.total_amount / totalPaymentMethodAmount) * 100).toFixed(1)
            : '0';
        const avg = r.transaction_count > 0 ? Math.round(r.total_amount / r.transaction_count) : 0;
        return [i + 1, m, r.transaction_count, r.total_amount, avg, `${pct}%`];
      });
      downloadCsv(filename, headers, rows);
    } else if (activeSubtype === 'customer') {
      const headers = [
        'Nama Pelanggan',
        'Tier',
        'Jumlah Transaksi',
        'Total Belanja',
        'Rata-rata Nota',
        'Total Profit',
      ];
      const rows = customerGrouped.map((r) => [
        r.name,
        r.tier,
        r.txCount,
        r.totalSpent,
        r.txCount > 0 ? (r.totalSpent / r.txCount).toFixed(0) : 0,
        r.totalProfit,
      ]);
      downloadCsv(filename, headers, rows);
    } else if (activeSubtype === 'product_margin') {
      const headers = [
        '#',
        'Nama Produk',
        'SKU',
        'Kategori',
        'Qty Terjual',
        'Total Omset',
        'Total HPP',
        'Margin (%)',
      ];
      const rows = productMarginData.map((r, i) => [
        i + 1,
        r.item_name,
        r.sku,
        r.category_name || '-',
        r.qty_sold,
        r.total_revenue,
        r.total_cogs,
        r.gross_margin,
      ]);
      downloadCsv(filename, headers, rows);
    }
  };

  const activeTabLabel = SUB_REPORT_TABS.find((s) => s.id === activeSubtype)?.label || 'Laporan Penjualan';

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card px-4 py-3 rounded-xl border border-line shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onBack}
            aria-label="Kembali ke daftar laporan"
            title="Kembali ke daftar laporan"
            className="px-2 shrink-0"
          >
            <ArrowLeft size={16} strokeWidth={1.75} />
          </Button>
          <h1 className="text-base font-bold text-heading tracking-tight truncate">
            Laporan Penjualan
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={fetchReportData}
            disabled={loading}
            aria-label="Muat ulang data"
            title="Muat ulang"
            className="px-2"
          >
            <RefreshCw size={14} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsPrintModalOpen(true)}
          >
            <Printer size={14} strokeWidth={1.75} />
            Cetak
          </Button>

          <Button type="button" variant="primary" size="sm" onClick={handleExportCsv}>
            <Download size={14} strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>
      </div>

      {/* KPI Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 shrink-0">
        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Total Omset</p>
          <p className="text-base font-bold text-heading tnum mt-1">
            Rp {kpi.revenue.toLocaleString('id-ID')}
          </p>
          <p className="text-[11px] text-dim tnum mt-0.5">
            {kpi.count.toLocaleString('id-ID')} {activeSubtype === 'detailed' ? 'baris item' : 'faktur'}
          </p>
        </div>

        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Total Diskon</p>
          <p className={`text-base font-bold tnum mt-1 ${kpi.discount > 0 ? 'text-danger' : 'text-heading'}`}>
            Rp {kpi.discount.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Total HPP</p>
          <p className="text-base font-bold text-heading tnum mt-1">
            Rp {kpi.cogs.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-card px-4 py-3 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Laba Kotor</p>
          <p className="text-base font-bold text-success tnum mt-1">
            Rp {kpi.profit.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-card px-4 py-3 rounded-xl border border-line col-span-2 sm:col-span-1">
          <p className="text-xs font-medium text-dim">Margin Kotor</p>
          <p className="text-base font-bold text-heading tnum mt-1">{kpi.margin.toFixed(1)}%</p>
        </div>
      </div>

      {/* Sub-Reports TabBar */}
      <TabBar
        tabs={SUB_REPORT_TABS}
        activeTab={activeSubtype}
        onTabChange={setActiveSubtype}
      />

      {/* Filter Toolbar */}
      <div className="bg-card p-3 rounded-xl border border-line flex flex-col gap-3 shrink-0">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-0.5 bg-muted p-0.5 rounded-lg border border-line">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'this_year', label: 'Tahun Ini' },
                { id: 'all', label: 'Semua' },
              ].map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => applyPreset(p.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                    presetPeriod === p.id
                      ? 'bg-card text-heading font-semibold border border-line'
                      : 'text-dim hover:text-heading border border-transparent'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-1.5 text-xs text-dim">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPresetPeriod('custom');
                }}
                aria-label="Tanggal mulai"
                className="h-8 px-2.5 bg-input border border-line rounded-lg text-heading text-xs tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              <span>s/d</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPresetPeriod('custom');
                }}
                aria-label="Tanggal akhir"
                className="h-8 px-2.5 bg-input border border-line rounded-lg text-heading text-xs tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 sm:flex-initial justify-end">
            <div className="relative w-full sm:w-56">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim"
                size={13}
                strokeWidth={1.75}
              />
              <input
                type="text"
                placeholder="Cari di tabel..."
                value={searchTableQuery}
                onChange={(e) => setSearchTableQuery(e.target.value)}
                aria-label="Cari di tabel"
                className="w-full h-8 pl-8 pr-7 bg-input border border-line rounded-lg text-heading text-xs focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              />
              {searchTableQuery && (
                <button
                  type="button"
                  onClick={() => setSearchTableQuery('')}
                  aria-label="Hapus pencarian"
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-dim hover:text-heading cursor-pointer"
                >
                  <X size={13} strokeWidth={1.75} />
                </button>
              )}
            </div>

            <Button
              type="button"
              variant={showAdvancedFilters || activeFilterCount > 0 ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className="shrink-0"
            >
              <Filter size={13} strokeWidth={1.75} />
              Filter
              {activeFilterCount > 0 && (
                <span className="inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-primary text-white text-[10px] font-bold tnum">
                  {activeFilterCount}
                </span>
              )}
              {showAdvancedFilters ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            </Button>
          </div>
        </div>

        {showAdvancedFilters && (
          <div className="pt-3 border-t border-line grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 animate-fade-in">
            <div>
              <label className="block text-xs font-medium text-dim mb-1">Pelanggan</label>
              <Select
                size="sm"
                value={selectedCustomerId}
                onChange={setSelectedCustomerId}
                ariaLabel="Filter pelanggan"
                className="w-full"
              >
                <option value="">Semua Pelanggan</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-dim mb-1">Kasir</label>
              <Select
                size="sm"
                value={selectedUserId}
                onChange={setSelectedUserId}
                ariaLabel="Filter kasir"
                className="w-full"
              >
                <option value="">Semua Kasir</option>
                {usersList.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name || u.username}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-dim mb-1">Metode Bayar</label>
              <Select
                size="sm"
                value={selectedPaymentMethod}
                onChange={setSelectedPaymentMethod}
                ariaLabel="Filter metode bayar"
                className="w-full"
              >
                <option value="all">Semua Metode</option>
                <option value="cash">Tunai</option>
                <option value="qris">QRIS</option>
                <option value="transfer">Transfer Bank</option>
                <option value="debit">Kartu Debit</option>
                <option value="credit">Kartu Kredit</option>
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-dim mb-1">Kategori</label>
              <Select
                size="sm"
                value={selectedCategoryId}
                onChange={setSelectedCategoryId}
                ariaLabel="Filter kategori"
                className="w-full"
              >
                <option value="">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="block text-xs font-medium text-dim mb-1">Tipe Harga</label>
              <Select
                size="sm"
                value={selectedPriceType}
                onChange={setSelectedPriceType}
                ariaLabel="Filter tipe harga"
                className="w-full"
              >
                <option value="all">Semua Tipe</option>
                <option value="retail">Eceran</option>
                <option value="wholesale">Grosir</option>
              </Select>
            </div>

            <div className="flex flex-col justify-end">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={resetFilters}
                disabled={activeFilterCount === 0}
                fullWidth
              >
                <RotateCcw size={13} strokeWidth={1.75} />
                Reset Filter
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Data Table Area */}
      <div className="flex-1 min-h-0 bg-card rounded-xl border border-line flex flex-col overflow-hidden">
        <div className="px-4 py-2.5 border-b border-line flex items-center justify-between gap-3 bg-muted/40 shrink-0">
          <div className="flex items-center gap-2 text-xs font-semibold text-heading">
            <span>{activeTabLabel}</span>
            {loading && <Loader2 size={13} className="animate-spin text-primary" />}
          </div>

          <div className="text-xs text-dim font-medium tnum">
            {activeSubtype === 'recap' && `${recapData.length} faktur`}
            {activeSubtype === 'detailed' && `${detailedData.length} baris`}
            {activeSubtype === 'payment_methods' && `${paymentMethodData.length} metode`}
            {activeSubtype === 'daily' && `${dailyData.length} hari`}
            {activeSubtype === 'customer' && `${customerGrouped.length} pelanggan`}
            {activeSubtype === 'cashier' && `${cashierData.length} kasir`}
            {activeSubtype === 'product_margin' && `${productMarginData.length} produk`}
          </div>
        </div>

        {error ? (
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <p className="text-sm text-danger font-medium">{error}</p>
            <Button type="button" variant="outline" size="sm" onClick={fetchReportData} className="mt-3">
              Coba Lagi
            </Button>
          </div>
        ) : (
          <div className="flex-1 overflow-auto custom-scrollbar">
            {/* 1: REKAP FAKTUR */}
            {activeSubtype === 'recap' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Waktu</th>
                      <th className="py-2.5 px-4">No. Transaksi</th>
                      <th className="py-2.5 px-4">Pelanggan</th>
                      <th className="py-2.5 px-4">Kasir</th>
                      <th className="py-2.5 px-4 text-right">Total Jual</th>
                      <th className="py-2.5 px-4 text-right">HPP</th>
                      <th className="py-2.5 px-4 text-right">Laba Kotor</th>
                      <th className="py-2.5 px-4 text-center">Bayar</th>
                      <th className="py-2.5 px-3 text-center">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {loading && recapData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-dim">
                          <Loader2 className="animate-spin text-primary mx-auto mb-2" size={22} />
                          Memuat data...
                        </td>
                      </tr>
                    ) : recapData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-16 text-dim">
                          Tidak ada transaksi penjualan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      recapData
                        .filter(
                          (r) =>
                            !searchTableQuery ||
                            r.transaction_no.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
                            r.customer_name.toLowerCase().includes(searchTableQuery.toLowerCase())
                        )
                        .map((row) => (
                          <tr key={row.sale_id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-4 text-dim tnum whitespace-nowrap">
                              {new Date(row.created_at).toLocaleDateString('id-ID', {
                                day: '2-digit',
                                month: '2-digit',
                              })}{' '}
                              {new Date(row.created_at).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </td>
                            <td className="py-2.5 px-4 font-semibold text-heading font-mono whitespace-nowrap">
                              {row.transaction_no}
                            </td>
                            <td className="py-2.5 px-4 text-heading">{row.customer_name}</td>
                            <td className="py-2.5 px-4 text-body">{row.cashier_name}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum whitespace-nowrap">
                              Rp {row.grand_total.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right text-dim tnum whitespace-nowrap">
                              Rp {row.total_cogs.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-success tnum whitespace-nowrap">
                              Rp {row.gross_profit.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-body">
                                {row.payment_methods}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <button
                                type="button"
                                onClick={() => setSelectedSaleId(row.sale_id)}
                                className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-lg transition-colors cursor-pointer"
                                aria-label="Lihat detail struk"
                                title="Lihat detail struk"
                              >
                                <Eye size={14} strokeWidth={1.75} />
                              </button>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 2: RINCIAN ITEM */}
            {activeSubtype === 'detailed' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-3">No. Nota</th>
                      <th className="py-2.5 px-3">Produk</th>
                      <th className="py-2.5 px-3">Kategori</th>
                      <th className="py-2.5 px-3 text-right">Qty</th>
                      <th className="py-2.5 px-3 text-right">Harga Jual</th>
                      <th className="py-2.5 px-3 text-right">Subtotal</th>
                      <th className="py-2.5 px-3 text-right">HPP</th>
                      <th className="py-2.5 px-3 text-right">Laba</th>
                      <th className="py-2.5 px-3 text-center">Bayar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {loading && detailedData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="py-16 text-center text-dim">
                          <Loader2 className="animate-spin text-primary mx-auto mb-2" size={22} />
                          Memuat data...
                        </td>
                      </tr>
                    ) : detailedData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-16 text-dim">
                          Tidak ada rincian item penjualan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      detailedData
                        .filter(
                          (r) =>
                            !searchTableQuery ||
                            r.item_name.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
                            r.transaction_no.toLowerCase().includes(searchTableQuery.toLowerCase())
                        )
                        .map((row) => (
                          <tr key={row.line_id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-3 font-mono text-body whitespace-nowrap">
                              {row.transaction_no}
                            </td>
                            <td className="py-2.5 px-3 font-medium text-heading">
                              {row.item_name}
                              <span className="block text-[11px] font-mono text-dim">{row.sku}</span>
                            </td>
                            <td className="py-2.5 px-3 text-dim">{row.category_name || '-'}</td>
                            <td className="py-2.5 px-3 text-right font-semibold text-heading tnum whitespace-nowrap">
                              {row.qty} {row.unit_name}
                            </td>
                            <td className="py-2.5 px-3 text-right text-heading tnum whitespace-nowrap">
                              Rp {row.price.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-heading tnum whitespace-nowrap">
                              Rp {row.subtotal.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-right text-dim tnum whitespace-nowrap">
                              Rp {row.line_cogs.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-semibold text-success tnum whitespace-nowrap">
                              Rp {row.line_profit.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-center">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-body">
                                {row.payment_methods}
                              </span>
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 3: DISTRIBUSI METODE PEMBAYARAN */}
            {activeSubtype === 'payment_methods' && (
              <div className="p-4 flex flex-col gap-4">
                {paymentMethodData.length === 0 ? (
                  <div className="text-center py-16 text-dim text-sm">
                    Tidak ada data pembayaran pada periode ini.
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {paymentMethodData.map((r) => {
                        const m = METHOD_CONFIG[r.method.toLowerCase()] || {
                          label: r.method.toUpperCase(),
                          icon: CreditCard,
                          color: 'bg-dim',
                        };
                        const Icon = m.icon;
                        const pct =
                          totalPaymentMethodAmount > 0
                            ? (r.total_amount / totalPaymentMethodAmount) * 100
                            : 0;
                        const avgPerNota =
                          r.transaction_count > 0
                            ? Math.round(r.total_amount / r.transaction_count)
                            : 0;

                        return (
                          <div
                            key={r.method}
                            className="bg-card rounded-xl border border-line p-4 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between gap-2 mb-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div className="w-8 h-8 rounded-lg bg-muted text-heading flex items-center justify-center shrink-0">
                                    <Icon size={16} strokeWidth={1.75} />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-heading text-xs truncate">{m.label}</p>
                                    <p className="text-[11px] text-dim tnum">{r.transaction_count} transaksi</p>
                                  </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-heading tnum shrink-0">
                                  {pct.toFixed(1)}%
                                </span>
                              </div>

                              <div className="text-base font-bold text-heading tnum mb-2">
                                Rp {r.total_amount.toLocaleString('id-ID')}
                              </div>

                              <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-2.5">
                                <div className={`h-full ${m.color} rounded-full`} style={{ width: `${pct}%` }} />
                              </div>
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-line text-[11px] text-dim">
                              <span>Rata-rata / nota</span>
                              <span className="font-semibold text-heading tnum">
                                Rp {avgPerNota.toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="rounded-xl border border-line overflow-hidden">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs border-collapse">
                          <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim">
                            <tr>
                              <th className="py-2.5 px-4 w-10">#</th>
                              <th className="py-2.5 px-4">Metode Pembayaran</th>
                              <th className="py-2.5 px-4 text-right">Jumlah Nota</th>
                              <th className="py-2.5 px-4 text-right">Rata-rata Nota</th>
                              <th className="py-2.5 px-4 text-right">Total Nominal</th>
                              <th className="py-2.5 px-4 text-right">Porsi</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-line">
                            {paymentMethodData
                              .filter(
                                (r) =>
                                  !searchTableQuery ||
                                  r.method.toLowerCase().includes(searchTableQuery.toLowerCase())
                              )
                              .map((row, idx) => {
                                const m = METHOD_CONFIG[row.method.toLowerCase()] || {
                                  label: row.method.toUpperCase(),
                                  color: 'bg-dim',
                                };
                                const pct =
                                  totalPaymentMethodAmount > 0
                                    ? (row.total_amount / totalPaymentMethodAmount) * 100
                                    : 0;
                                const avgPerNota =
                                  row.transaction_count > 0
                                    ? Math.round(row.total_amount / row.transaction_count)
                                    : 0;

                                return (
                                  <tr key={row.method} className="hover:bg-muted/40 transition-colors">
                                    <td className="py-2.5 px-4 tnum text-dim">{idx + 1}</td>
                                    <td className="py-2.5 px-4 font-medium text-heading">
                                      <span className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full ${m.color}`} />
                                        {m.label}
                                      </span>
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-medium text-heading tnum">
                                      {row.transaction_count}
                                    </td>
                                    <td className="py-2.5 px-4 text-right text-body tnum whitespace-nowrap">
                                      Rp {avgPerNota.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-semibold text-heading tnum whitespace-nowrap">
                                      Rp {row.total_amount.toLocaleString('id-ID')}
                                    </td>
                                    <td className="py-2.5 px-4 text-right font-semibold text-heading tnum">
                                      {pct.toFixed(1)}%
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* 4: PENJUALAN HARIAN */}
            {activeSubtype === 'daily' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Tanggal</th>
                      <th className="py-2.5 px-4 text-right">Nota</th>
                      <th className="py-2.5 px-4 text-right">Tunai</th>
                      <th className="py-2.5 px-4 text-right">Non-Tunai</th>
                      <th className="py-2.5 px-4 text-right">Total Omset</th>
                      <th className="py-2.5 px-4 text-right">HPP</th>
                      <th className="py-2.5 px-4 text-right">Laba Kotor</th>
                      <th className="py-2.5 px-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {dailyData.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center py-16 text-dim">
                          Tidak ada data harian pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      dailyData
                        .filter(
                          (r) =>
                            !searchTableQuery ||
                            r.date_label.toLowerCase().includes(searchTableQuery.toLowerCase())
                        )
                        .map((row) => (
                          <tr key={row.date} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-heading tnum whitespace-nowrap">
                              {row.date_label}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-heading tnum">
                              {row.transaction_count}
                            </td>
                            <td className="py-2.5 px-4 text-right text-heading tnum whitespace-nowrap">
                              Rp {row.total_cash.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right text-heading tnum whitespace-nowrap">
                              Rp {row.total_non_cash.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum whitespace-nowrap">
                              Rp {row.total_revenue.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right text-dim tnum whitespace-nowrap">
                              Rp {row.total_cogs.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-success tnum whitespace-nowrap">
                              Rp {row.gross_profit.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum">
                              {row.gross_margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 5: PER PELANGGAN */}
            {activeSubtype === 'customer' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Pelanggan</th>
                      <th className="py-2.5 px-4">Tier</th>
                      <th className="py-2.5 px-4 text-right">Transaksi</th>
                      <th className="py-2.5 px-4 text-right">Total Belanja</th>
                      <th className="py-2.5 px-4 text-right">Rata-rata Nota</th>
                      <th className="py-2.5 px-4 text-right">Kontribusi Laba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {customerGrouped.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-16 text-dim">
                          Tidak ada transaksi pelanggan pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      customerGrouped
                        .filter(
                          (r) =>
                            !searchTableQuery ||
                            r.name.toLowerCase().includes(searchTableQuery.toLowerCase())
                        )
                        .map((row) => (
                          <tr key={row.name} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-heading">{row.name}</td>
                            <td className="py-2.5 px-4">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-semibold bg-muted text-body capitalize">
                                {row.tier}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-heading tnum">
                              {row.txCount}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum whitespace-nowrap">
                              Rp {row.totalSpent.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right text-body tnum whitespace-nowrap">
                              Rp{' '}
                              {row.txCount > 0
                                ? Math.round(row.totalSpent / row.txCount).toLocaleString('id-ID')
                                : 0}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-success tnum whitespace-nowrap">
                              Rp {row.totalProfit.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 6: PER KASIR */}
            {activeSubtype === 'cashier' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4">Kasir</th>
                      <th className="py-2.5 px-4">Role</th>
                      <th className="py-2.5 px-4 text-right">Nota</th>
                      <th className="py-2.5 px-4 text-right">Tunai (Laci)</th>
                      <th className="py-2.5 px-4 text-right">Non-Tunai</th>
                      <th className="py-2.5 px-4 text-right">Total Penjualan</th>
                      <th className="py-2.5 px-4 text-right">Total Laba</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {cashierData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-dim">
                          Tidak ada data kinerja kasir pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      cashierData
                        .filter(
                          (r) =>
                            !searchTableQuery ||
                            r.cashier_name.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
                            r.role.toLowerCase().includes(searchTableQuery.toLowerCase())
                        )
                        .map((row) => (
                          <tr key={row.user_id} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-4 font-semibold text-heading">{row.cashier_name}</td>
                            <td className="py-2.5 px-4">
                              <span className="inline-block px-2 py-0.5 rounded-md text-[11px] font-medium bg-muted text-body capitalize">
                                {row.role}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-heading tnum">
                              {row.transaction_count}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-success tnum whitespace-nowrap">
                              Rp {row.total_cash.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-medium text-heading tnum whitespace-nowrap">
                              Rp {row.total_non_cash.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum whitespace-nowrap">
                              Rp {row.total_revenue.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-success tnum whitespace-nowrap">
                              Rp {row.gross_profit.toLocaleString('id-ID')}
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* 7: MARGIN PRODUK */}
            {activeSubtype === 'product_margin' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-muted/60 border-b border-line text-xs font-semibold text-dim sticky top-0 z-10">
                    <tr>
                      <th className="py-2.5 px-4 w-10">#</th>
                      <th className="py-2.5 px-4">Produk</th>
                      <th className="py-2.5 px-4">Kategori</th>
                      <th className="py-2.5 px-4 text-right">Qty Terjual</th>
                      <th className="py-2.5 px-4 text-right">Total Omset</th>
                      <th className="py-2.5 px-4 text-right">Total HPP</th>
                      <th className="py-2.5 px-4 text-right">Margin</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {productMarginData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-16 text-dim">
                          Tidak ada data penjualan produk pada periode ini.
                        </td>
                      </tr>
                    ) : (
                      productMarginData
                        .filter(
                          (r) =>
                            !searchTableQuery ||
                            r.item_name.toLowerCase().includes(searchTableQuery.toLowerCase()) ||
                            r.sku.toLowerCase().includes(searchTableQuery.toLowerCase())
                        )
                        .map((row, idx) => (
                          <tr key={row.sku} className="hover:bg-muted/40 transition-colors">
                            <td className="py-2.5 px-4 tnum text-dim">{idx + 1}</td>
                            <td className="py-2.5 px-4 font-medium text-heading">
                              {row.item_name}
                              <span className="block text-[11px] font-mono text-dim">{row.sku}</span>
                            </td>
                            <td className="py-2.5 px-4 text-dim">{row.category_name || '-'}</td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum">
                              {row.qty_sold}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-heading tnum whitespace-nowrap">
                              Rp {row.total_revenue.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right text-dim tnum whitespace-nowrap">
                              Rp {row.total_cogs.toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-4 text-right font-semibold text-success tnum">
                              {row.gross_margin.toFixed(1)}%
                            </td>
                          </tr>
                        ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {selectedSaleId && (
        <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      )}

      <PrintReportModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        title={activeTabLabel}
        periodLabel={`${dateFrom} s/d ${dateTo}`}
        filterDetails={[
          { label: 'Cara Bayar', value: selectedPaymentMethod.toUpperCase() },
          { label: 'Kasir', value: selectedUserId ? 'Filter Tertentu' : 'Semua Kasir' },
          { label: 'Pelanggan', value: selectedCustomerId ? 'Filter Tertentu' : 'Semua Pelanggan' },
        ]}
        columns={
          activeSubtype === 'detailed'
            ? [
                { header: 'No. Nota', accessor: (r) => r.transaction_no },
                { header: 'Nama Produk', accessor: (r) => r.item_name },
                { header: 'Qty', accessor: (r) => `${r.qty} ${r.unit_name}`, align: 'center' },
                { header: 'Harga', accessor: (r) => `Rp ${r.price.toLocaleString('id-ID')}`, align: 'right' },
                { header: 'Subtotal', accessor: (r) => `Rp ${r.subtotal.toLocaleString('id-ID')}`, align: 'right' },
                { header: 'Laba', accessor: (r) => `Rp ${r.line_profit.toLocaleString('id-ID')}`, align: 'right' },
              ]
            : [
                { header: 'No. Transaksi', accessor: (r) => r.transaction_no },
                { header: 'Waktu', accessor: (r) => new Date(r.created_at).toLocaleDateString('id-ID') },
                { header: 'Pelanggan', accessor: (r) => r.customer_name },
                { header: 'Total Belanja', accessor: (r) => `Rp ${r.grand_total.toLocaleString('id-ID')}`, align: 'right' },
                { header: 'HPP', accessor: (r) => `Rp ${r.total_cogs.toLocaleString('id-ID')}`, align: 'right' },
                { header: 'Laba Kotor', accessor: (r) => `Rp ${r.gross_profit.toLocaleString('id-ID')}`, align: 'right' },
                { header: 'Bayar', accessor: (r) => r.payment_methods.toUpperCase(), align: 'center' },
              ]
        }
        data={activeSubtype === 'detailed' ? detailedData : recapData}
        summaryItems={[
          { label: 'Total Omset', value: `Rp ${kpi.revenue.toLocaleString('id-ID')}`, isHighlight: true },
          { label: 'Total Diskon', value: `Rp ${kpi.discount.toLocaleString('id-ID')}` },
          { label: 'Total HPP', value: `Rp ${kpi.cogs.toLocaleString('id-ID')}` },
          { label: 'Total Laba Kotor', value: `Rp ${kpi.profit.toLocaleString('id-ID')}`, isHighlight: true },
        ]}
      />
    </div>
  );
}
