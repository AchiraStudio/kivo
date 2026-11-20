import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { getPurchaseSummary, PurchaseSummaryRow } from '../../lib/api';
import ReportHeader from '../../components/reports/ReportHeader';
import { getFirstOfMonthDateString, getTodayDateString } from './reportUtils';
import Button from '../../components/ui/Button';

interface Props {
  onBack: () => void;
}

export default function LaporanPembelian({ onBack }: Props) {
  const [dateFrom, setDateFrom] = useState(getFirstOfMonthDateString());
  const [dateTo, setDateTo] = useState(getTodayDateString());
  const [data, setData] = useState<PurchaseSummaryRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await getPurchaseSummary('branch_001', dateFrom, dateTo));
    } catch (e) {
      console.error(e);
      setError('Gagal memuat laporan pembelian.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const grandTotal = data.reduce((s, r) => s + r.total_amount, 0);
  const grandPaid = data.reduce((s, r) => s + r.paid_amount, 0);
  const grandCount = data.reduce((s, r) => s + r.purchase_count, 0);

  return (
    <div className="flex flex-col gap-4 animate-fade-in h-full">
      <ReportHeader
        title="Rekap Pembelian"
        onBack={onBack}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFetch={fetchData}
      />

      <div className="bg-card rounded-xl border border-line flex-1 min-h-0 overflow-hidden flex flex-col">
        <div className="overflow-x-auto flex-1 custom-scrollbar">
          <table className="w-full text-left border-collapse">
            <thead className="bg-muted/60 border-b border-line text-xs text-dim font-semibold sticky top-0 z-10">
              <tr>
                <th className="py-3 px-4">Pemasok</th>
                <th className="py-3 px-4 text-right">Jumlah PO</th>
                <th className="py-3 px-4 text-right">Total Pembelian</th>
                <th className="py-3 px-4 text-right">Sudah Dibayar</th>
                <th className="py-3 px-4 text-right">Sisa Hutang</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line text-sm">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-dim">
                    <Loader2 className="animate-spin text-primary mx-auto mb-2" size={24} />
                    <span className="text-xs">Memuat data...</span>
                  </td>
                </tr>
              ) : error ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    <p className="text-sm text-danger font-medium">{error}</p>
                    <Button type="button" variant="outline" size="sm" onClick={fetchData} className="mt-3">
                      Coba Lagi
                    </Button>
                  </td>
                </tr>
              ) : data.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-16 text-center text-dim text-sm">
                    Tidak ada data pada periode ini.
                  </td>
                </tr>
              ) : (
                data.map((r) => {
                  const balance = r.total_amount - r.paid_amount;
                  return (
                    <tr key={r.supplier_name} className="hover:bg-muted/40 transition-colors">
                      <td className="py-3 px-4 font-semibold text-heading">{r.supplier_name}</td>
                      <td className="py-3 px-4 text-right tnum text-heading">{r.purchase_count}</td>
                      <td className="py-3 px-4 text-right tnum font-semibold text-heading">
                        Rp {r.total_amount.toLocaleString('id-ID')}
                      </td>
                      <td className="py-3 px-4 text-right tnum text-success">
                        Rp {r.paid_amount.toLocaleString('id-ID')}
                      </td>
                      <td
                        className={`py-3 px-4 text-right tnum font-bold ${
                          balance > 0 ? 'text-danger' : 'text-dim'
                        }`}
                      >
                        {balance > 0 ? `Rp ${balance.toLocaleString('id-ID')}` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            {data.length > 0 && !loading && !error && (
              <tfoot className="bg-muted/60 border-t border-line text-sm font-bold">
                <tr>
                  <td className="py-3 px-4 text-heading">Total</td>
                  <td className="py-3 px-4 text-right tnum text-heading">{grandCount}</td>
                  <td className="py-3 px-4 text-right tnum text-heading">
                    Rp {grandTotal.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-right tnum text-success">
                    Rp {grandPaid.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-right tnum text-danger">
                    Rp {(grandTotal - grandPaid).toLocaleString('id-ID')}
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
