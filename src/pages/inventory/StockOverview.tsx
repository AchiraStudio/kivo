import { useState, useEffect } from 'react';
import {
  Search,
  Loader2,
  AlertTriangle,
  ShieldCheck,
  RefreshCw,
  Layers,
  Activity,
  History,
  PackageOpen,
  Pencil,
  FileSpreadsheet,
  AlertCircle,
} from 'lucide-react';
import { getStockOverview, StockOverviewRow, exportStockExcel, getCategories, Category } from '../../lib/api';
import SetInitialStockModal from './SetInitialStockModal';
import StockAdjustModal from './StockAdjustModal';
import StockMovementsPanel from './StockMovementsPanel';
import BulkStockAdd from './BulkStockAdd';
import { save } from '@tauri-apps/plugin-dialog';
import Button from '../../components/ui/Button';
import Select from '../../components/ui/Select';
import { toast } from '../../components/ui/Toast';

interface StockOverviewProps {
  refreshTrigger: number;
  onEditItem: (itemId: string) => void;
}

export default function StockOverview({ refreshTrigger, onEditItem }: StockOverviewProps) {
  const [stockRows, setStockRows] = useState<StockOverviewRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterMode, setFilterMode] = useState<'all' | 'low'>('all');

  const [initItem, setInitItem] = useState<StockOverviewRow | null>(null);
  const [adjustItem, setAdjustItem] = useState<StockOverviewRow | null>(null);
  const [historyItem, setHistoryItem] = useState<StockOverviewRow | null>(null);
  const [bulkAdjustOpen, setBulkAdjustOpen] = useState(false);

  const DEFAULT_BRANCH_ID = 'branch_001';

  useEffect(() => {
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const loadStockData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await getStockOverview(DEFAULT_BRANCH_ID);
      setStockRows(data);
    } catch (error: any) {
      console.error('Failed to load inventory stocks:', error);
      setErrorMsg(error?.message || String(error));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStockData();
  }, [refreshTrigger]);

  const handleExportExcel = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
        defaultPath: 'Laporan_Inventory.xlsx',
      });
      if (filePath) {
        setLoading(true);
        await exportStockExcel(filePath);
        toast.success('Data inventaris berhasil diekspor ke Excel.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengekspor data: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const totalItemsCount = stockRows.length;
  const lowStockCount = stockRows.filter((r) => r.is_low_stock).length;

  const filteredRows = stockRows.filter((row) => {
    const matchesSearch =
      row.item_name.toLowerCase().includes(search.toLowerCase()) ||
      row.sku.toLowerCase().includes(search.toLowerCase());
    const matchesTab = filterMode === 'all' || row.is_low_stock;
    const matchesCategory = !selectedCategory || row.category_name === selectedCategory;
    return matchesSearch && matchesTab && matchesCategory;
  });

  return (
    <div className="flex flex-col gap-4 animate-fade-in w-full h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5">
          <h1 className="text-lg font-bold text-heading tracking-tight">Saldo Stok</h1>
          <span className="px-2 py-0.5 rounded-full bg-muted text-dim text-xs font-semibold border border-line tnum">
            {totalItemsCount}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExportExcel}>
            <FileSpreadsheet size={14} /> Ekspor Excel
          </Button>
          <Button variant="primary" size="sm" onClick={() => setBulkAdjustOpen(true)}>
            <Activity size={14} /> Tambah Massal
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadStockData}
            disabled={loading}
            className="px-2"
            title="Muat Ulang"
            aria-label="Muat ulang data stok"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 shrink-0">
        <div className="bg-card border border-line p-4 rounded-xl flex items-center gap-3.5">
          <div className="p-2.5 bg-muted text-dim rounded-lg shrink-0">
            <Layers size={18} />
          </div>
          <div>
            <p className="text-xs font-medium text-dim">Total Produk</p>
            <h4 className="text-xl font-bold text-heading tnum mt-0.5">{totalItemsCount}</h4>
          </div>
        </div>

        <div className="bg-card border border-line p-4 rounded-xl flex items-center gap-3.5">
          <div
            className={`p-2.5 rounded-lg shrink-0 ${
              lowStockCount > 0 ? 'bg-warning-soft text-warning' : 'bg-success-soft text-success'
            }`}
          >
            {lowStockCount > 0 ? <AlertTriangle size={18} /> : <ShieldCheck size={18} />}
          </div>
          <div>
            <p className="text-xs font-medium text-dim">Di Bawah Minimum</p>
            <h4 className="text-xl font-bold text-heading tnum mt-0.5">{lowStockCount}</h4>
          </div>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-line flex flex-col flex-1 min-h-0 overflow-hidden">
        <div className="p-3 border-b border-line flex flex-col sm:flex-row gap-2.5 justify-between bg-muted/40">
          <div className="flex items-center gap-0.5 bg-muted p-1 rounded-lg border border-line self-start">
            <button
              type="button"
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                filterMode === 'all'
                  ? 'bg-card text-heading border border-line'
                  : 'text-dim hover:text-heading border border-transparent'
              }`}
            >
              Semua
            </button>
            <button
              type="button"
              onClick={() => setFilterMode('low')}
              className={`px-3 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary tnum ${
                filterMode === 'low'
                  ? 'bg-card text-warning border border-line'
                  : 'text-dim hover:text-heading border border-transparent'
              }`}
            >
              <AlertTriangle size={12} /> Stok Menipis ({lowStockCount})
            </button>
          </div>

          <div className="flex-1 sm:max-w-md flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="flex-1 flex items-center h-9 bg-input border border-line rounded-lg px-3 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20 transition-colors">
              <Search size={15} className="text-dim mr-2 shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cari nama atau SKU..."
                className="bg-transparent border-none outline-none text-sm w-full text-heading placeholder:text-dim"
              />
            </div>
            <Select
              value={selectedCategory}
              onChange={(v) => setSelectedCategory(v)}
              className="w-full sm:w-44"
              ariaLabel="Filter kategori"
            >
              <option value="">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="flex-1 overflow-auto custom-scrollbar relative">
          <table className="w-full text-left border-collapse">
            <thead className="sticky top-0 bg-muted z-10 border-b border-line">
              <tr className="text-dim text-xs font-semibold">
                <th className="py-2.5 px-4">Produk</th>
                <th className="py-2.5 px-4">SKU</th>
                <th className="py-2.5 px-4">Kategori</th>
                <th className="py-2.5 px-4 text-center">Satuan</th>
                <th className="py-2.5 px-4 text-right">Stok Min.</th>
                <th className="py-2.5 px-4 text-right">Saldo</th>
                <th className="py-2.5 px-4 text-center w-40">Aksi</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 size={22} className="animate-spin mx-auto text-primary" />
                    <p className="text-xs text-dim mt-2">Memuat data stok...</p>
                  </td>
                </tr>
              ) : errorMsg ? (
                <tr>
                  <td colSpan={7} className="py-14 text-center">
                    <AlertCircle size={22} className="mx-auto text-danger mb-2" />
                    <p className="text-sm font-semibold text-heading">Gagal memuat stok</p>
                    <p className="text-xs text-dim mt-0.5 mb-3">{errorMsg}</p>
                    <Button variant="outline" size="sm" onClick={loadStockData}>
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-sm text-dim">
                    Tidak ada produk yang cocok dengan filter.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr key={row.item_id} className="hover:bg-muted/40 transition-colors fast-render-row">
                    <td className="py-2.5 px-4 font-semibold text-heading">
                      <div>{row.item_name}</div>
                      {row.current_qty < 0 ? (
                        <span className="text-[11px] text-danger block font-semibold tnum">
                          Defisit {Math.abs(row.current_qty)}
                        </span>
                      ) : row.is_low_stock ? (
                        <span className="text-[11px] text-warning block font-medium">Perlu restock</span>
                      ) : null}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-dim">{row.sku}</td>
                    <td className="py-2.5 px-4">
                      {row.category_name ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-muted text-body border border-line">
                          {row.category_name}
                        </span>
                      ) : (
                        <span className="text-xs text-dim">-</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-center text-xs text-body">{row.unit_name || '-'}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-xs text-body tnum">
                      {row.min_stock}
                    </td>
                    <td
                      className={`py-2.5 px-4 text-right font-mono font-bold text-sm tnum ${
                        row.current_qty < 0
                          ? 'text-danger'
                          : row.is_low_stock
                          ? 'text-warning'
                          : 'text-heading'
                      }`}
                    >
                      {row.current_qty < 0 ? (
                        <span className="px-2 py-0.5 rounded-md bg-danger-soft text-danger">
                          {row.current_qty}
                        </span>
                      ) : (
                        row.current_qty
                      )}
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => onEditItem(row.item_id)}
                          className="p-1.5 rounded-lg text-dim hover:bg-muted hover:text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Edit Produk"
                          aria-label="Edit Produk"
                        >
                          <Pencil size={15} />
                        </button>
                        {!row.has_ledger_entries && row.unit_id && (
                          <button
                            type="button"
                            onClick={() => setInitItem(row)}
                            className="p-1.5 rounded-lg text-dim hover:bg-muted hover:text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                            title="Atur Stok Awal"
                            aria-label="Atur Stok Awal"
                          >
                            <PackageOpen size={15} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setAdjustItem(row)}
                          disabled={!row.unit_id}
                          className="p-1.5 rounded-lg text-dim hover:bg-muted hover:text-heading transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Sesuaikan Stok"
                          aria-label="Sesuaikan Stok"
                        >
                          <Activity size={15} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setHistoryItem(row)}
                          className="p-1.5 rounded-lg text-dim hover:bg-muted hover:text-heading transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                          title="Riwayat Mutasi"
                          aria-label="Riwayat Mutasi"
                        >
                          <History size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <SetInitialStockModal
        isOpen={!!initItem}
        onClose={() => setInitItem(null)}
        item={initItem}
        branchId={DEFAULT_BRANCH_ID}
        onSuccess={loadStockData}
      />
      <StockAdjustModal
        isOpen={!!adjustItem}
        onClose={() => setAdjustItem(null)}
        item={adjustItem}
        branchId={DEFAULT_BRANCH_ID}
        onSuccess={loadStockData}
      />
      <StockMovementsPanel
        isOpen={!!historyItem}
        onClose={() => setHistoryItem(null)}
        item={historyItem}
        branchId={DEFAULT_BRANCH_ID}
      />
      <BulkStockAdd
        isOpen={bulkAdjustOpen}
        onClose={() => setBulkAdjustOpen(false)}
        branchId={DEFAULT_BRANCH_ID}
        onSuccess={loadStockData}
      />
    </div>
  );
}
