import { useState, useEffect, useMemo } from 'react';
import {
  ShoppingCart,
  PackageCheck,
  RefreshCw,
  Plus,
  CheckCircle2,
  ChevronRight,
  CreditCard,
  Banknote,
  Smartphone,
  ArrowRightLeft,
  FileSpreadsheet,
  Eye,
  BarChart3,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react';
import {
  getLowStockAlerts,
  LowStockAlert,
  getSalesSummary,
  SalesSummaryRow,
  getSales,
  Sale,
  getTopSellingItems,
  TopItemRow,
  getSalesByPaymentMethod,
  PaymentMethodRow,
  getStockValuation,
  getExpiringItems,
  ExpiringItemRow,
} from '../lib/api';
import { useAuthStore } from '../store/AuthStore';
import SaleDetailModal from './pos/SaleDetailModal';
import Button from './ui/Button';

interface DashboardProps {
  setActiveMenu: (menu: string) => void;
}

type PeriodType = 'today' | '7days' | 'month';

const PAYMENT_ICON_MAP: Record<string, { label: string; icon: any; tone: string; bar: string }> = {
  cash:     { label: 'Tunai',    icon: Banknote,       tone: 'text-success', bar: 'bg-success' },
  transfer: { label: 'Transfer', icon: ArrowRightLeft, tone: 'text-accent',  bar: 'bg-accent' },
  debit:    { label: 'Debit',    icon: CreditCard,     tone: 'text-primary', bar: 'bg-primary' },
  credit:   { label: 'Kredit',   icon: CreditCard,     tone: 'text-primary', bar: 'bg-primary' },
  qris:     { label: 'QRIS',     icon: Smartphone,     tone: 'text-warning', bar: 'bg-warning' },
};

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

export default function Dashboard({ setActiveMenu }: DashboardProps) {
  const { user } = useAuthStore();
  const branchId = user?.branch_id || 'branch_001';

  const [period, setPeriod] = useState<PeriodType>('today');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [summary, setSummary] = useState<SalesSummaryRow | null>(null);
  const [weeklySummary, setWeeklySummary] = useState<SalesSummaryRow[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [topItems, setTopItems] = useState<TopItemRow[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodRow[]>([]);
  const [lowStockAlerts, setLowStockAlerts] = useState<LowStockAlert[]>([]);
  const [expiringAlerts, setExpiringAlerts] = useState<ExpiringItemRow[]>([]);
  const [totalStockValuation, setTotalStockValuation] = useState<number>(0);

  const [alertTab, setAlertTab] = useState<'lowStock' | 'expiring'>('lowStock');
  const [selectedSaleId, setSelectedSaleId] = useState<string | null>(null);

  const dateRange = useMemo(() => {
    const now = new Date();
    const todayStr = formatDateLocal(now);

    if (period === 'today') {
      return { from: todayStr, to: todayStr };
    }
    if (period === '7days') {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6);
      return { from: formatDateLocal(sevenDaysAgo), to: todayStr };
    }
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    return { from: formatDateLocal(firstOfMonth), to: todayStr };
  }, [period]);

  const fetchDashboardData = async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    else setLoading(true);
    setLoadError(null);

    try {
      const now = new Date();
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(now.getDate() - 6);
      const weekFromStr = formatDateLocal(sevenDaysAgo);
      const todayStr = formatDateLocal(now);

      const [
        summaryRes,
        weeklySummaryRes,
        salesRes,
        topItemsRes,
        paymentsRes,
        lowStockRes,
        expiringRes,
        valuationRes,
      ] = await Promise.all([
        getSalesSummary(branchId, dateRange.from, dateRange.to).catch(() => []),
        getSalesSummary(branchId, weekFromStr, todayStr).catch(() => []),
        getSales(branchId).catch(() => []),
        getTopSellingItems(branchId, dateRange.from, dateRange.to, 5).catch(() => []),
        getSalesByPaymentMethod(branchId, dateRange.from, dateRange.to).catch(() => []),
        getLowStockAlerts(branchId).catch(() => []),
        getExpiringItems(branchId, 90).catch(() => []),
        getStockValuation(branchId).catch(() => []),
      ]);

      if (summaryRes.length > 0) {
        const aggregated: SalesSummaryRow = summaryRes.reduce(
          (acc, row) => ({
            period_label: period,
            transaction_count: acc.transaction_count + row.transaction_count,
            total_revenue: acc.total_revenue + row.total_revenue,
            total_discount: acc.total_discount + row.total_discount,
            total_cogs: acc.total_cogs + row.total_cogs,
            gross_profit: acc.gross_profit + row.gross_profit,
          }),
          {
            period_label: period,
            transaction_count: 0,
            total_revenue: 0,
            total_discount: 0,
            total_cogs: 0,
            gross_profit: 0,
          }
        );
        setSummary(aggregated);
      } else {
        setSummary(null);
      }

      setWeeklySummary(weeklySummaryRes);
      setSales(salesRes.slice(0, 6));
      setTopItems(topItemsRes);
      setPaymentMethods(paymentsRes);
      setLowStockAlerts(lowStockRes);
      setExpiringAlerts(expiringRes);
      setTotalStockValuation(valuationRes.reduce((s, r) => s + r.total_value, 0));
    } catch (e: any) {
      console.error('Failed to load dashboard data:', e);
      setLoadError(e?.message || 'Gagal memuat ringkasan.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, [period, branchId]);

  useEffect(() => {
    const handleSync = () => fetchDashboardData(true);
    window.addEventListener('kivo:sync', handleSync);
    return () => window.removeEventListener('kivo:sync', handleSync);
  }, [period, branchId]);

  const totalRevenue = summary?.total_revenue || 0;
  const transactionCount = summary?.transaction_count || 0;
  const grossProfit = summary?.gross_profit || 0;
  const avgBasket = transactionCount > 0 ? Math.round(totalRevenue / transactionCount) : 0;
  const profitMargin = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0';
  const totalPaymentsAmount = paymentMethods.reduce((s, p) => s + p.total_amount, 0);

  const maxDayRevenue = useMemo(() => {
    if (weeklySummary.length === 0) return 100000;
    const maxVal = Math.max(...weeklySummary.map(d => d.total_revenue));
    return maxVal > 0 ? maxVal : 100000;
  }, [weeklySummary]);

  const totalAlerts = lowStockAlerts.length + expiringAlerts.length;

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar min-h-0 flex flex-col gap-4 w-full pb-6 pr-0.5">
      {/* Toolbar: Period Switcher & Primary Quick Actions */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="primary" size="sm" onClick={() => setActiveMenu('pos')}>
            <ShoppingCart size={14} strokeWidth={1.75} />
            Kasir
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveMenu('inventory')}>
            <Plus size={14} strokeWidth={1.75} />
            Barang
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveMenu('purchasing')}>
            <PackageCheck size={14} strokeWidth={1.75} />
            Terima Stok
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActiveMenu('reports')}>
            <FileSpreadsheet size={14} strokeWidth={1.75} />
            Laporan
          </Button>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="bg-muted p-0.5 rounded-lg flex items-center border border-line" role="tablist" aria-label="Periode">
            {(
              [
                { id: 'today', label: 'Hari Ini' },
                { id: '7days', label: '7 Hari' },
                { id: 'month', label: 'Bulan Ini' },
              ] as const
            ).map(tab => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={period === tab.id}
                onClick={() => setPeriod(tab.id)}
                className={`px-2.5 h-7 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                  period === tab.id
                    ? 'bg-card text-heading border border-line'
                    : 'text-dim hover:text-heading border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => fetchDashboardData(true)}
            disabled={refreshing}
            aria-label="Muat ulang data"
            className="w-8 h-8 flex items-center justify-center rounded-lg border border-line bg-card hover:bg-muted text-dim hover:text-heading transition-colors disabled:opacity-50 cursor-pointer"
            title="Muat ulang"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin text-primary' : ''} />
          </button>
        </div>
      </div>

      {loadError && (
        <div className="px-3.5 py-2.5 rounded-lg bg-danger-soft border border-danger/25 text-danger text-xs font-medium flex items-center justify-between gap-3">
          <span>{loadError}</span>
          <Button variant="outline" size="sm" onClick={() => fetchDashboardData(true)}>
            Coba Lagi
          </Button>
        </div>
      )}

      {/* Key Operational Strip (Unified Flat Bar, Single Focal Revenue Metric) */}
      <div className="bg-card border border-line rounded-xl grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-line">
        <div className="p-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-dim">Pendapatan</span>
          <p className="text-2xl font-bold text-heading tracking-tight tnum">
            {loading ? '...' : `Rp ${totalRevenue.toLocaleString('id-ID')}`}
          </p>
          <span className="text-xs text-dim tnum">
            {transactionCount} transaksi · rata-rata Rp {avgBasket.toLocaleString('id-ID')}
          </span>
        </div>

        <div className="p-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-dim">Laba Kotor</span>
          <p className="text-xl font-bold text-heading tracking-tight tnum">
            {loading ? '...' : `Rp ${grossProfit.toLocaleString('id-ID')}`}
          </p>
          <span className="text-xs text-success font-medium tnum">Margin {profitMargin}%</span>
        </div>

        <div className="p-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-dim">Valuasi Stok</span>
          <p className="text-xl font-bold text-heading tracking-tight tnum">
            {loading ? '...' : `Rp ${totalStockValuation.toLocaleString('id-ID')}`}
          </p>
          <span className="text-xs text-dim">Modal persediaan aktif</span>
        </div>

        <div className="p-4 flex flex-col justify-between gap-1.5">
          <span className="text-xs font-medium text-dim">Peringatan Stok</span>
          <p className={`text-xl font-bold tracking-tight tnum ${totalAlerts > 0 ? 'text-danger' : 'text-heading'}`}>
            {loading ? '...' : totalAlerts}
          </p>
          <span className="text-xs text-dim tnum">
            {lowStockAlerts.length} menipis · {expiringAlerts.length} kadaluarsa
          </span>
        </div>
      </div>

      {/* Main 2-Column Operational Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* Left: Recent Sales + 7-Day Trend + Top Products */}
        <div className="lg:col-span-7 space-y-4">
          {/* Recent Transactions */}
          <div className="bg-card rounded-xl border border-line overflow-hidden flex flex-col">
            <div className="px-4 py-3 border-b border-line flex justify-between items-center">
              <h3 className="font-bold text-heading text-sm">Transaksi Terakhir</h3>
              <button
                type="button"
                onClick={() => setActiveMenu('pos')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Kasir <ChevronRight size={14} />
              </button>
            </div>

            {loading ? (
              <div className="py-8 text-center text-xs text-dim">Memuat transaksi...</div>
            ) : sales.length === 0 ? (
              <div className="py-8 px-4 text-center text-dim text-xs flex flex-col items-center gap-2">
                <ShoppingCart size={20} className="text-dim" />
                <span>Belum ada transaksi pada periode ini.</span>
                <Button variant="outline" size="sm" onClick={() => setActiveMenu('pos')}>
                  Buka Kasir
                </Button>
              </div>
            ) : (
              <>
                <div className="sm:hidden divide-y divide-line">
                  {sales.map(s => (
                    <button
                      type="button"
                      key={s.id}
                      onClick={() => setSelectedSaleId(s.id)}
                      className="w-full p-3.5 flex items-center justify-between gap-3 hover:bg-muted/50 transition-colors text-left cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-xs text-heading truncate">
                            {s.transaction_no}
                          </span>
                          <span className="text-[11px] font-mono text-dim tnum shrink-0">
                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-xs text-dim mt-0.5 truncate">
                          {(s as any).customer_name || (s.customer_id ? 'Pelanggan' : 'Umum')}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className="text-xs font-bold text-heading font-mono tnum">
                          Rp {s.grand_total.toLocaleString('id-ID')}
                        </span>
                        <ChevronRight size={14} className="text-dim" />
                      </div>
                    </button>
                  ))}
                </div>

                <div className="hidden sm:block overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-muted/60 border-b border-line text-dim font-semibold">
                      <tr>
                        <th className="py-2.5 px-4">Waktu</th>
                        <th className="py-2.5 px-4">No. Struk</th>
                        <th className="py-2.5 px-4">Pelanggan</th>
                        <th className="py-2.5 px-4 text-right">Total</th>
                        <th className="py-2.5 px-4 text-right w-12"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-line">
                      {sales.map(s => (
                        <tr key={s.id} className="hover:bg-muted/40 transition-colors">
                          <td className="py-2.5 px-4 font-mono text-dim tnum">
                            {new Date(s.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-semibold text-heading">
                            {s.transaction_no}
                          </td>
                          <td className="py-2.5 px-4 text-body">
                            {(s as any).customer_name || (s.customer_id ? 'Pelanggan' : 'Umum')}
                          </td>
                          <td className="py-2.5 px-4 text-right font-semibold text-heading font-mono tnum">
                            Rp {s.grand_total.toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedSaleId(s.id)}
                              aria-label={`Detail ${s.transaction_no}`}
                              className="p-1.5 text-dim hover:text-heading hover:bg-muted rounded-md transition-colors cursor-pointer"
                              title="Detail struk"
                            >
                              <Eye size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>

          {/* 7-Day Revenue Bar Chart */}
          <div className="bg-card rounded-xl border border-line p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-bold text-heading">Pendapatan 7 Hari Terakhir</h3>
              <span className="text-xs text-dim tnum">
                Maks Rp {maxDayRevenue.toLocaleString('id-ID')}
              </span>
            </div>

            {weeklySummary.length === 0 ? (
              <div className="py-6 text-center text-xs text-dim flex flex-col items-center gap-1.5">
                <BarChart3 size={20} className="text-dim" />
                <span>Belum ada data penjualan 7 hari terakhir.</span>
              </div>
            ) : (
              <div className="flex items-end justify-between gap-2.5 h-32 pt-3">
                {weeklySummary.map((day, idx) => {
                  const heightPercent = Math.max(8, Math.min(100, (day.total_revenue / maxDayRevenue) * 100));
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center gap-1.5 group relative">
                      <div className="absolute -top-8 opacity-0 group-hover:opacity-100 transition-opacity bg-elevated border border-line text-heading text-[11px] font-semibold py-1 px-2 rounded-md shadow-lg shadow-black/15 dark:shadow-black/45 pointer-events-none z-20 whitespace-nowrap tnum">
                        Rp {day.total_revenue.toLocaleString('id-ID')} ({day.transaction_count})
                      </div>
                      <div className="w-full bg-muted rounded-md h-24 flex items-end p-0.5 overflow-hidden">
                        <div
                          className="w-full bg-primary/85 group-hover:bg-primary rounded-sm transition-colors"
                          style={{ height: `${heightPercent}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-dim tnum truncate max-w-full">
                        {day.period_label.slice(5)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Top 5 Products */}
          <div className="bg-card rounded-xl border border-line p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-heading text-sm">Produk Terlaris</h3>
              <button
                type="button"
                onClick={() => setActiveMenu('reports')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Semua <ChevronRight size={14} />
              </button>
            </div>

            {topItems.length === 0 ? (
              <p className="text-center text-xs text-dim py-4">Belum ada produk terjual.</p>
            ) : (
              <div className="divide-y divide-line">
                {topItems.map((item, idx) => {
                  const maxQty = topItems[0]?.qty_sold || 1;
                  const percent = Math.min(100, Math.round((item.qty_sold / maxQty) * 100));
                  return (
                    <div key={item.sku || idx} className="py-2.5 first:pt-0 last:pb-0 flex items-center gap-3">
                      <span className="w-5 text-xs font-mono font-semibold text-dim tnum shrink-0">
                        {idx + 1}.
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center gap-2 mb-1">
                          <p className="font-semibold text-xs text-heading truncate">{item.item_name}</p>
                          <span className="font-semibold text-xs text-body font-mono tnum shrink-0">
                            {item.qty_sold}
                          </span>
                        </div>
                        <div className="h-1 bg-muted rounded-full overflow-hidden">
                          <div className="h-full bg-primary rounded-full" style={{ width: `${percent}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Stock Alerts & Payment Split */}
        <div className="lg:col-span-5 space-y-4">
          <div className="bg-card rounded-xl border border-line p-4 flex flex-col max-h-[440px]">
            <div className="flex items-center justify-between gap-2 pb-3 border-b border-line shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle size={15} className={totalAlerts > 0 ? 'text-danger shrink-0' : 'text-dim shrink-0'} />
                <h3 className="font-bold text-heading text-sm truncate">Peringatan Stok</h3>
              </div>

              <div className="flex items-center bg-muted p-0.5 rounded-lg border border-line shrink-0">
                <button
                  type="button"
                  onClick={() => setAlertTab('lowStock')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer tnum ${
                    alertTab === 'lowStock'
                      ? 'bg-card text-heading border border-line'
                      : 'text-dim hover:text-heading border border-transparent'
                  }`}
                >
                  Menipis ({lowStockAlerts.length})
                </button>
                <button
                  type="button"
                  onClick={() => setAlertTab('expiring')}
                  className={`px-2 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer tnum ${
                    alertTab === 'expiring'
                      ? 'bg-card text-heading border border-line'
                      : 'text-dim hover:text-heading border border-transparent'
                  }`}
                >
                  Exp ({expiringAlerts.length})
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar pt-2.5 divide-y divide-line pr-0.5">
              {alertTab === 'lowStock' ? (
                lowStockAlerts.length === 0 ? (
                  <div className="py-8 text-center flex flex-col items-center gap-1.5">
                    <CheckCircle2 size={22} className="text-success" />
                    <p className="text-xs font-semibold text-heading">Stok aman</p>
                  </div>
                ) : (
                  lowStockAlerts.map((item, idx) => (
                    <div key={item.sku || idx} className="py-2.5 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-xs text-heading truncate">{item.item_name}</p>
                        <p className="text-[11px] text-dim font-mono">{item.sku || '-'}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-xs font-semibold text-danger bg-danger-soft px-2 py-0.5 rounded-md tnum">
                          {item.current_qty} {item.unit_name}
                        </span>
                        <p className="text-[11px] text-dim mt-0.5 tnum">Min {item.min_stock}</p>
                      </div>
                    </div>
                  ))
                )
              ) : expiringAlerts.length === 0 ? (
                <div className="py-8 text-center flex flex-col items-center gap-1.5">
                  <CheckCircle2 size={22} className="text-success" />
                  <p className="text-xs font-semibold text-heading">Tidak ada batch mendekati kadaluarsa</p>
                </div>
              ) : (
                expiringAlerts.map((item, idx) => (
                  <div key={idx} className="py-2.5 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-xs text-heading truncate">{item.item_name}</p>
                      <p className="text-[11px] text-dim font-mono">
                        {item.batch_no || '-'} · {item.expiry_date}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-xs font-semibold text-warning bg-warning-soft px-2 py-0.5 rounded-md tnum">
                        {item.days_left} hari
                      </span>
                      <p className="text-[11px] text-dim mt-0.5 tnum">Sisa {item.qty}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-2.5 mt-2 border-t border-line flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setActiveMenu('inventory')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Buka Inventaris <ChevronRight size={14} />
              </button>
            </div>
          </div>

          {/* Payment Method Breakdown */}
          <div className="bg-card rounded-xl border border-line p-4 space-y-3">
            <div className="flex justify-between items-center">
              <h3 className="font-bold text-heading text-sm">Metode Pembayaran</h3>
              <button
                type="button"
                onClick={() => setActiveMenu('reports')}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-0.5 cursor-pointer"
              >
                Detail <ChevronRight size={14} />
              </button>
            </div>

            {paymentMethods.length === 0 ? (
              <p className="text-center text-xs text-dim py-4">Belum ada pembayaran.</p>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map(pm => {
                  const info = PAYMENT_ICON_MAP[pm.method] || {
                    label: pm.method,
                    icon: TrendingUp,
                    tone: 'text-dim',
                    bar: 'bg-line-strong',
                  };
                  const Icon = info.icon;
                  const percent =
                    totalPaymentsAmount > 0
                      ? ((pm.total_amount / totalPaymentsAmount) * 100).toFixed(1)
                      : '0';

                  return (
                    <div key={pm.method} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Icon size={14} className={`${info.tone} shrink-0`} />
                          <span className="font-semibold text-heading truncate">{info.label}</span>
                          <span className="text-[11px] text-dim tnum">({pm.transaction_count})</span>
                        </div>
                        <div className="font-semibold text-heading font-mono tnum shrink-0">
                          Rp {pm.total_amount.toLocaleString('id-ID')}{' '}
                          <span className="text-[11px] text-dim font-sans font-normal">{percent}%</span>
                        </div>
                      </div>
                      <div className="h-1 bg-muted rounded-full overflow-hidden">
                        <div className={`h-full ${info.bar} rounded-full`} style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedSaleId && (
        <SaleDetailModal saleId={selectedSaleId} onClose={() => setSelectedSaleId(null)} />
      )}
    </div>
  );
}
