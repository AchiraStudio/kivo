import { useState, useEffect } from 'react';
import { Search, Loader2, RefreshCw, FileSpreadsheet } from 'lucide-react';
import { getStockValuation, StockValuationRow, exportStockExcel, getCategories, Category } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import { save } from '@tauri-apps/plugin-dialog';
import ReportHeader from '../../components/reports/ReportHeader';
import { toast } from '../../components/ui/Toast';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

export default function LaporanStok({ onBack }: Props) {
  const [data, setData] = useState<StockValuationRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getStockValuation('branch_001'));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data valuasi stok.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const handleExportExcel = async () => {
    try {
      const filePath = await save({
        filters: [{ name: 'Excel Files', extensions: ['xlsx'] }],
        defaultPath: 'Laporan_Stok.xlsx',
      });
      if (filePath) {
        setLoading(true);
        await exportStockExcel(filePath);
        toast.success('Data stok berhasil diekspor ke Excel.');
      }
    } catch (e) {
      console.error(e);
      toast.error('Gagal mengekspor data: ' + e);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = () => {
    const headers = ['#', 'Nama Item', 'SKU', 'Kategori', 'Satuan', 'Qty Saat Ini', 'HPP Rata-rata', 'Total Nilai'];
    const rows = filtered.map((r, i) => [
      i + 1,
      r.item_name,
      r.sku,
      r.category_name || '-',
      r.unit_name || '-',
      r.current_qty,
      r.avg_hpp,
      r.total_value,
    ]);
    downloadCsv('Laporan_Stok.csv', headers, rows);
  };

  const filtered = data.filter((r) => {
    const matchesSearch =
      r.item_name.toLowerCase().includes(search.toLowerCase()) ||
      r.sku.toLowerCase().includes(search.toLowerCase());
    const matchesCat = !selectedCategory || r.category_name === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const grandTotal = filtered.reduce((s, r) => s + r.total_value, 0);
  const totalUnits = filtered.reduce((s, r) => s + r.current_qty, 0);

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader title="Valuasi Stok" onBack={onBack} onExportCsv={handleExportCsv}>
        <div className="relative">
          <Search size={14} strokeWidth={1.75} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-dim" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari item atau SKU..."
            aria-label="Cari item atau SKU"
            className="h-8 pl-8 pr-3 bg-input border border-line rounded-lg text-xs text-heading w-44 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>

        <Select
          size="sm"
          value={selectedCategory}
          onChange={setSelectedCategory}
          ariaLabel="Filter kategori"
          className="w-40"
        >
          <option value="">Semua Kategori</option>
          {categories.map((c) => (
            <option key={c.id} value={c.name}>
              {c.name}
            </option>
          ))}
        </Select>

        <Button type="button" variant="primary" size="sm" onClick={handleExportExcel} disabled={loading}>
          <FileSpreadsheet size={14} strokeWidth={1.75} />
          Export Excel
        </Button>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={fetchData}
          disabled={loading}
          aria-label="Muat ulang"
          title="Muat ulang"
          className="px-2"
        >
          <RefreshCw size={14} strokeWidth={1.75} className={loading ? 'animate-spin' : ''} />
        </Button>
      </ReportHeader>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 shrink-0">
        <div className="bg-card px-4 py-3.5 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Total Nilai Inventaris</p>
          <p className="text-lg font-bold text-heading tnum mt-1">
            Rp {grandTotal.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-card px-4 py-3.5 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Jumlah SKU</p>
          <p className="text-lg font-bold text-heading tnum mt-1">
            {filtered.length.toLocaleString('id-ID')}
          </p>
        </div>

        <div className="bg-card px-4 py-3.5 rounded-xl border border-line">
          <p className="text-xs font-medium text-dim">Total Unit Fisik</p>
          <p className="text-lg font-bold text-heading tnum mt-1">
            {totalUnits.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Item</th>
                <th className="py-3 px-4">SKU</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4">Satuan</th>
                <th className="py-3 px-4 text-right">Stok</th>
                <th className="py-3 px-4 text-right">HPP Rata-rata</th>
                <th className="py-3 px-4 text-right">Nilai Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-dim">
                    <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <span className="text-xs">Memuat data...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <p className="text-sm text-danger font-medium">{error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-3">
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-dim text-sm">
                    Tidak ada data stok.
                  </td>
                </tr>
              ) : (
                filtered.map((r) => (
                  <tr key={r.sku} className="hover:bg-muted/40 transition-colors">
                    <td className="py-3 px-4 font-semibold text-heading">{r.item_name}</td>
                    <td className="py-3 px-4 font-mono text-xs text-dim">{r.sku}</td>
                    <td className="py-3 px-4 text-body">{r.category_name || '-'}</td>
                    <td className="py-3 px-4 text-body">{r.unit_name || '-'}</td>
                    <td className="py-3 px-4 text-right tnum font-semibold text-heading">
                      {r.current_qty.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right tnum text-body">
                      Rp {r.avg_hpp.toLocaleString('id-ID')}
                    </td>
                    <td className="py-3 px-4 text-right tnum font-bold text-heading">
                      Rp {r.total_value.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
