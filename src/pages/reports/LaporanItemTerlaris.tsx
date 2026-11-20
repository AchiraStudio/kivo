import { useState, useEffect } from 'react';
import { Loader2, Trophy, Medal } from 'lucide-react';
import { getTopSellingItems, TopItemRow, getCategories, Category } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import ReportHeader from '../../components/reports/ReportHeader';
import { getFirstOfMonthDateString, getTodayDateString } from './reportUtils';
import Select from '../../components/ui/Select';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

function RankBadge({ rank }: { rank: number }) {
  if (rank === 0) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-soft text-warning"
        title="Peringkat 1"
      >
        <Trophy size={13} strokeWidth={1.75} />
      </span>
    );
  }
  if (rank === 1) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-muted text-body"
        title="Peringkat 2"
      >
        <Medal size={13} strokeWidth={1.75} />
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-warning-soft text-warning"
        title="Peringkat 3"
      >
        <Medal size={13} strokeWidth={1.75} />
      </span>
    );
  }
  return <span className="text-xs tnum text-dim font-semibold pl-1.5">{rank + 1}</span>;
}

export default function LaporanItemTerlaris({ onBack }: Props) {
  const [dateFrom, setDateFrom] = useState(getFirstOfMonthDateString());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [data, setData] = useState<TopItemRow[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getTopSellingItems('branch_001', dateFrom, dateTo, 50));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat data item terlaris.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    getCategories().then(setCategories).catch(console.error);
  }, []);

  const filteredData = data.filter((r) => !selectedCategory || r.category_name === selectedCategory);

  const handleExportCsv = () => {
    const headers = ['#', 'Nama Item', 'SKU', 'Kategori', 'Qty Terjual', 'Total Penjualan', 'Total HPP', 'Margin (%)'];
    const rows = filteredData.map((r, i) => [
      i + 1,
      r.item_name,
      r.sku,
      r.category_name,
      r.qty_sold,
      r.total_revenue,
      r.total_cogs,
      r.gross_margin.toFixed(1),
    ]);
    downloadCsv('Laporan_Item_Terlaris.csv', headers, rows);
  };

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader
        title="Item Terlaris & Margin"
        onBack={onBack}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFetch={fetchData}
        onExportCsv={handleExportCsv}
      >
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
      </ReportHeader>

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4 w-12">#</th>
                <th className="py-3 px-4">Nama Item</th>
                <th className="py-3 px-4">Kategori</th>
                <th className="py-3 px-4 text-right">Qty Terjual</th>
                <th className="py-3 px-4 text-right">Total Penjualan</th>
                <th className="py-3 px-4 text-right">Total HPP</th>
                <th className="py-3 px-4 text-right">Margin</th>
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
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-dim text-sm">
                    Tidak ada data pada periode ini.
                  </td>
                </tr>
              ) : (
                filteredData.map((r, i) => {
                  const marginColor =
                    r.gross_margin >= 30
                      ? 'text-success'
                      : r.gross_margin >= 10
                      ? 'text-warning'
                      : 'text-danger';
                  return (
                    <tr
                      key={r.sku}
                      className={`hover:bg-muted/40 transition-colors ${i < 3 ? 'bg-warning-soft/25' : ''}`}
                    >
                      <td className="py-3 px-4">
                        <RankBadge rank={i} />
                      </td>
                      <td className="py-3 px-4">
                        <p className="font-semibold text-heading">{r.item_name}</p>
                        <p className="text-[11px] font-mono text-dim">{r.sku}</p>
                      </td>
                      <td className="py-3 px-4 text-body">{r.category_name || '-'}</td>
                      <td className="py-3 px-4 text-right tnum text-heading">
                        {r.qty_sold.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right tnum font-semibold text-heading">
                        Rp {r.total_revenue.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right tnum text-dim">
                        Rp {r.total_cogs.toLocaleString('id-ID')}
                      </td>
                      <td className={`py-3 px-4 text-right font-bold tnum ${marginColor}`}>
                        {r.gross_margin.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
