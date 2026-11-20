import { useEffect, useState } from 'react';
import { getTrialBalance, TrialBalanceRow } from '../../lib/api';
import { downloadCsv } from '../../lib/exportCsv';
import { Download, RefreshCw, Loader2 } from 'lucide-react';
import Button from '../../components/ui/Button';

export default function ReportTB() {
  const [data, setData] = useState<TrialBalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [asOfDate, setAsOfDate] = useState(() => new Date().toISOString().split('T')[0]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTrialBalance(asOfDate);
      setData(res);
    } catch (e) {
      console.error(e);
      setError('Gagal memuat neraca saldo.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [asOfDate]);

  const totalDebit = data.reduce((sum, r) => sum + r.total_debit, 0);
  const totalCredit = data.reduce((sum, r) => sum + r.total_credit, 0);

  const handleExportCsv = () => {
    const headers = ['Kode Akun', 'Nama Akun', 'Saldo Debit', 'Saldo Kredit'];
    const rows = data.map((row) => [
      row.code,
      row.name,
      row.total_debit > row.total_credit ? row.total_debit - row.total_credit : 0,
      row.total_credit > row.total_debit ? row.total_credit - row.total_debit : 0,
    ]);
    downloadCsv(`Neraca_Saldo_${asOfDate}.csv`, headers, rows);
  };

  return (
    <div className="flex flex-col h-full gap-4 animate-fade-in">
      <div className="flex flex-wrap justify-between items-center gap-3 shrink-0">
        <h2 className="text-base font-bold tracking-tight text-heading">Neraca Saldo</h2>
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
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={data.length === 0}
          >
            <Download size={14} strokeWidth={1.75} />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 bg-card rounded-xl border border-line overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-sm text-left border-collapse">
            <thead className="text-xs text-dim bg-muted/60 font-semibold sticky top-0 border-b border-line z-10">
              <tr>
                <th className="px-4 py-3">Kode Akun</th>
                <th className="px-4 py-3">Nama Akun</th>
                <th className="px-4 py-3 text-right">Saldo Debit (Rp)</th>
                <th className="px-4 py-3 text-right">Saldo Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {loading ? (
                <tr>
                  <td colSpan={4} className="text-center py-14 text-dim">
                    <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <span className="text-xs">Memuat laporan...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={4} className="text-center py-14">
                    <p className="text-sm text-danger font-medium">{error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-3">
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={4} className="text-center py-14 text-dim text-sm">
                    Tidak ada saldo akun pada tanggal ini.
                  </td>
                </tr>
              ) : (
                data.map((row) => (
                  <tr key={row.account_id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-dim whitespace-nowrap">{row.code}</td>
                    <td className="px-4 py-3 font-medium text-heading">{row.name}</td>
                    <td className="px-4 py-3 text-right tnum text-heading whitespace-nowrap">
                      {row.total_debit > row.total_credit
                        ? (row.total_debit - row.total_credit).toLocaleString('id-ID')
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-right tnum text-heading whitespace-nowrap">
                      {row.total_credit > row.total_debit
                        ? (row.total_credit - row.total_debit).toLocaleString('id-ID')
                        : '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {data.length > 0 && !loading && !error && (
              <tfoot className="bg-muted/60 font-bold border-t border-line sticky bottom-0">
                <tr>
                  <td colSpan={2} className="px-4 py-3 text-right text-body">
                    Total
                  </td>
                  <td className="px-4 py-3 text-right tnum text-heading whitespace-nowrap">
                    {totalDebit.toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 text-right tnum text-heading whitespace-nowrap">
                    {totalCredit.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}
