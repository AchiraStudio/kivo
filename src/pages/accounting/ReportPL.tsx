import { useEffect, useState } from 'react';
import { getProfitLoss, ProfitLossReport } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function ReportPL() {
  const [data, setData] = useState<ProfitLossReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getProfitLoss(startDate, endDate);
      setData(res);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat laporan laba rugi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  const handleExportCsv = () => {
    if (!data) return;
    const headers = ['Kategori', 'Kode Akun', 'Nama Akun', 'Nominal (Rp)'];
    const rows: any[][] = [];
    data.revenue?.rows.forEach((r: any) => rows.push(['Pendapatan', r.account_code, r.account_name, r.amount]));
    data.cogs?.rows.forEach((r: any) => rows.push(['HPP', r.account_code, r.account_name, r.amount]));
    rows.push(['Ringkasan', '', 'Laba Kotor', data.gross_profit]);
    data.expenses?.rows.forEach((r: any) => rows.push(['Beban Operasional', r.account_code, r.account_name, r.amount]));
    rows.push(['Ringkasan', '', 'Laba / (Rugi) Bersih', data.net_profit]);
    downloadCsv(`Laba_Rugi_${startDate}_sd_${endDate}.csv`, headers, rows);
  };

  const renderGroup = (group: any, label: string) => {
    if (!group) return null;
    return (
      <div className="mb-5">
        <h3 className="font-semibold text-dim text-xs mb-2 pb-2 border-b border-line">{label}</h3>
        {group.rows.length === 0 ? (
          <p className="py-2 text-xs text-dim">Tidak ada mutasi.</p>
        ) : (
          group.rows.map((row: any) => (
            <div key={row.account_code} className="flex justify-between py-2 text-sm text-body gap-4">
              <div className="pl-2 truncate">{row.account_name}</div>
              <div className="tnum shrink-0">{row.amount.toLocaleString('id-ID')}</div>
            </div>
          ))
        )}
        <div className="flex justify-between py-2.5 text-sm font-semibold text-heading border-t border-line mt-1.5">
          <div>Total {label}</div>
          <div className="tnum">Rp {group.total.toLocaleString('id-ID')}</div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3 shrink-0">
        <h2 className="text-base font-bold tracking-tight text-heading">Laba Rugi</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            aria-label="Tanggal mulai"
            className="h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
          <span className="text-dim text-xs">s/d</span>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            aria-label="Tanggal akhir"
            className="h-8 bg-input border border-line rounded-lg px-2.5 text-xs text-heading tnum focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
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
          <Button type="button" variant="outline" size="sm" onClick={handleExportCsv} disabled={!data}>
            <Download size={14} strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="overflow-y-auto flex-1 p-5 sm:p-6 custom-scrollbar">
          {loading ? (
            <div className="text-center py-14 text-dim">
              <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
              <span className="text-xs">Memuat laporan...</span>
            </div>
          ) : error ? (
            <div className="text-center py-14">
              <p className="text-sm text-danger font-medium">{error}</p>
              <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-3">
                Coba Lagi
              </Button>
            </div>
          ) : data ? (
            <div className="max-w-3xl mx-auto">
              {renderGroup(data.revenue, 'Pendapatan')}
              {renderGroup(data.cogs, 'Harga Pokok Penjualan (HPP)')}

              <div className="flex justify-between items-center py-3.5 px-4 mb-6 text-sm font-bold text-heading bg-muted rounded-xl border border-line">
                <div>Laba Kotor</div>
                <div className="tnum">Rp {data.gross_profit.toLocaleString('id-ID')}</div>
              </div>

              {renderGroup(data.expenses, 'Beban Operasional')}

              <div
                className={`flex justify-between items-center py-4 px-4 text-base font-bold rounded-xl border mt-6 ${
                  data.net_profit >= 0
                    ? 'bg-success-soft text-success border-success/30'
                    : 'bg-danger-soft text-danger border-danger/30'
                }`}
              >
                <div>Laba / (Rugi) Bersih</div>
                <div className="tnum">Rp {data.net_profit.toLocaleString('id-ID')}</div>
              </div>
            </div>
          ) : (
            <div className="text-center py-14 text-dim text-sm">Tidak ada data tersedia.</div>
          )}
        </div>
      </div>
    </div>
  );
}
