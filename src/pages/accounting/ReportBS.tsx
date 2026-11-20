import { useEffect, useState } from 'react';
import { getBalanceSheet, BalanceSheet as BalanceSheetData } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function ReportBS() {
  const [data, setData] = useState<BalanceSheetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getBalanceSheet(asOfDate);
      setData(res);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat neraca keuangan.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [asOfDate]);

  const handleExportCsv = () => {
    if (!data) return;
    const headers = ['Bagian', 'Kode Akun', 'Nama Akun', 'Nominal (Rp)'];
    const rows: any[][] = [];
    data.assets.forEach((r: any) => rows.push(['Aset', r.account_code, r.account_name, r.amount]));
    rows.push(['Ringkasan', '', 'Total Aset', data.total_assets]);
    data.liabilities.forEach((r: any) => rows.push(['Kewajiban', r.account_code, r.account_name, r.amount]));
    data.equity.forEach((r: any) => rows.push(['Ekuitas', r.account_code, r.account_name, r.amount]));
    rows.push(['Ringkasan', '', 'Total Kewajiban & Ekuitas', data.total_liabilities_equity]);
    downloadCsv(`Neraca_Keuangan_${asOfDate}.csv`, headers, rows);
  };

  const renderSection = (title: string, rows: any[], total: number) => (
    <div className="flex-1 bg-muted/50 p-5 rounded-xl border border-line flex flex-col">
      <h3 className="font-bold text-heading text-sm mb-3 pb-2 border-b border-line">{title}</h3>
      <div className="space-y-2.5 mb-5 flex-1">
        {rows.length === 0 ? (
          <p className="text-xs text-dim">Tidak ada saldo akun.</p>
        ) : (
          rows.map((row: any) => (
            <div key={row.account_code} className="flex justify-between text-sm text-body gap-4">
              <div className="truncate">{row.account_name}</div>
              <div className="tnum shrink-0">{row.amount.toLocaleString('id-ID')}</div>
            </div>
          ))
        )}
      </div>
      <div className="flex justify-between pt-3 text-sm font-bold text-heading border-t border-line">
        <div>Total {title}</div>
        <div className="tnum">Rp {total.toLocaleString('id-ID')}</div>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3 shrink-0">
        <h2 className="text-base font-bold tracking-tight text-heading">Neraca Keuangan</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-dim">Per tanggal</span>
          <input
            type="date"
            value={asOfDate}
            onChange={(e) => setAsOfDate(e.target.value)}
            aria-label="Per tanggal"
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="flex flex-col gap-4">
                {renderSection('Aset', data.assets, data.total_assets)}

                <div className="flex justify-between items-center py-3.5 px-5 text-sm font-bold text-heading bg-muted rounded-xl border border-line">
                  <div>Total Aset</div>
                  <div className="tnum">Rp {data.total_assets.toLocaleString('id-ID')}</div>
                </div>
              </div>

              <div className="flex flex-col gap-4">
                {renderSection(
                  'Kewajiban',
                  data.liabilities,
                  data.liabilities.reduce((sum, r) => sum + r.amount, 0)
                )}
                {renderSection(
                  'Ekuitas',
                  data.equity,
                  data.equity.reduce((sum, r) => sum + r.amount, 0)
                )}

                <div
                  className={`mt-auto flex justify-between items-center py-3.5 px-5 text-sm font-bold rounded-xl border ${
                    data.total_assets === data.total_liabilities_equity
                      ? 'bg-success-soft text-success border-success/30'
                      : 'bg-danger-soft text-danger border-danger/30'
                  }`}
                >
                  <div>Total Kewajiban & Ekuitas</div>
                  <div className="tnum">Rp {data.total_liabilities_equity.toLocaleString('id-ID')}</div>
                </div>
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
